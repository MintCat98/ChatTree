// Watches the DOM for new chatbox elements via MutationObserver.
import {
  mergeMountedNodes,
  getCachedNodes,
  resetNodeCache,
  seedNodeCache,
  buildTree,
} from './chatbox-tracker';
import { watchBranchChanges } from './branch-change-watcher';
import { sendToBackground, requestFromBackground } from './message-bridge';
import { SELECTORS, TIMING, CHAT_URL_PATTERN } from '@shared/constants';
import { MessageType } from '@shared/message-types';
import type { ChatboxNode, TreeData } from '@shared/types';
import { startTracking, stopTracking, observeNode } from './active-node-tracker';
import { usePanelStore } from './panel/store/panel-store';

export const TREE_READY_EVENT = 'chattree:ready';

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentNodes: ChatboxNode[] = [];
let branchCleanup: (() => void) | null = null;
// Conversation this observer was started for. buildTree stamps sessionId from
// the URL *at dispatch time*, and on SPA navigation the URL flips before the
// DOM swaps — so a scan can carry the previous conversation's nodes under the
// next conversation's sessionId. Dispatches are dropped on mismatch.
let currentSessionId: string | null = null;
// Until hydration settles, scans update the panel but are NOT persisted —
// otherwise the first post-navigation scan (a handful of mounted turns) races
// GET_STORED_TREE and can overwrite the accumulated stored tree.
let persistReady = false;
// Whether the currently mounted DOM is known to belong to this conversation.
// After an SPA navigation the previous conversation's turns can still be
// mounted (the URL flips before React swaps the view), so scanning — merging
// foreign turns, honoring a foreign aria-setsize — would corrupt the hydrated
// cache. The first mutation after startObserving is the render activity of the
// new conversation and restores trust.
let domTrusted = true;

function dispatchTree(tree: TreeData): void {
  // Scan spanned an SPA transition — the cache/DOM belong to the previous
  // conversation while the URL already points at the next one. Drop it.
  if (tree.sessionId !== currentSessionId) return;

  window.dispatchEvent(new CustomEvent(TREE_READY_EVENT, { detail: { tree } }));

  if (!persistReady) return;
  // Persist to session-store via SW (fire-and-forget; Panel already updated above)
  sendToBackground({
    type: MessageType.TREE_UPDATE,
    payload: { nodes: tree.nodes, sessionId: tree.sessionId },
  }).catch(() => {});
}

function handleDOMChange(): void {
  // console.log('[ChatTree DBG] handleDOMChange (debounce queued)');
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    // Merge instead of rebuild — virtualization unmounts off-screen bubbles,
    // so a raw DOM scan would drop them from the tree (chat count would
    // change while scrolling). The cache keeps every turn seen this session.
    currentNodes = mergeMountedNodes();
    // console.log('[ChatTree DBG] DOM change → tree built, nodeCount=', currentNodes.length);
    dispatchTree(buildTree(currentNodes));
    document
      .querySelectorAll(`[${SELECTORS.NAV_ID_ATTR}]`)
      .forEach((el) => observeNode(el));
  }, TIMING.OBSERVER_DEBOUNCE);
}

// Seeds the node cache from the tree persisted for this conversation
// (issue #152), then re-dispatches so the panel shows the full tree without
// the user having to scroll through the whole conversation again.
// Settling this request (success or failure) opens the persistence gate.
function hydrateFromStoredTree(): void {
  const sessionId = currentSessionId;
  if (!sessionId) {
    persistReady = true;
    return;
  }

  requestFromBackground<{ tree: TreeData | null }>({
    type: MessageType.GET_STORED_TREE,
    payload: { sessionId },
  })
    .then((response) => {
      const tree = response?.tree;
      if (!tree || tree.sessionId !== sessionId || tree.nodes.length === 0) return;
      seedNodeCache(tree.nodes);
    })
    .catch(() => {}) // no stored tree / SW unreachable — scanning fills the tree as usual
    .finally(() => {
      // Observer torn down / conversation changed while the request was in
      // flight (SPA nav) — the response belongs to a conversation we left.
      if (!observer || currentSessionId !== sessionId) return;
      persistReady = true;
      // Re-dispatch now that persistence is open, so the merged tree (seeded
      // or plain initial scan) reaches storage exactly once hydration settled.
      // While the mounted DOM may still belong to the previous conversation,
      // dispatch the seeded cache as-is instead of scanning.
      currentNodes = domTrusted ? mergeMountedNodes() : getCachedNodes();
      dispatchTree(buildTree(currentNodes));
    });
}

// Rebuilds the tree from the live DOM only, dropping the accumulated cache.
// Used after the user clears the cached trees (issue #153): the panel shows a
// freshly scanned tree instead of going blank, and dispatchTree re-persists
// the current conversation via TREE_UPDATE.
export function rescanFromDom(): void {
  if (!observer) return;
  resetNodeCache();
  currentNodes = mergeMountedNodes();
  dispatchTree(buildTree(currentNodes));
}

export function startObserving(options?: { trustExistingDom?: boolean }): void {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  // console.log('[ChatTree DBG] startObserving — container found?', !!container, 'selector=', SELECTORS.CHAT_CONTAINER);
  if (!container) return;

  currentNodes = [];
  resetNodeCache(); // fresh conversation — accumulated turns belong to the old one
  // 'unknown' matches buildTree's fallback so dispatches still flow on any
  // URL shape we failed to parse (startObserving only runs on chat URLs).
  currentSessionId = location.href.match(CHAT_URL_PATTERN)?.[1] ?? 'unknown';
  persistReady = false;
  // On initial page load the rendered DOM is this conversation's; after an SPA
  // navigation it may still be the previous one's (index.ts passes false).
  domTrusted = options?.trustExistingDom ?? true;

  observer = new MutationObserver((mutations) => {
    // Scan the WHOLE batch — the streaming-end attribute flip usually arrives
    // in the same batch as childList churn (final text, indicator removal),
    // so an early exit on the first childList record would skip it.
    let domChanged = false;
    for (const mutation of mutations) {
      // Chatboxes mount as childList additions — opening an existing
      // conversation never flips the streaming attribute, so element
      // changes must trigger a rescan too. Debounce absorbs the churn.
      if (
        mutation.type === 'childList' &&
        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
      ) {
        domChanged = true;
      }
      // End of streaming — the settled DOM is the authoritative state.
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === SELECTORS.STREAMING_ATTR &&
        (mutation.target as HTMLElement).getAttribute(SELECTORS.STREAMING_ATTR) === 'false'
      ) {
        domChanged = true;
        // Generation-complete notification (issue #166). Only a genuine
        // 'true' → 'false' flip counts — opening an existing conversation
        // sets the attribute to 'false' on mount (oldValue null), which is
        // not a completion.
        if (mutation.oldValue === 'true') {
          usePanelStore.getState().setGenerationComplete(true);
        }
      }
    }
    if (domChanged) {
      // Render activity after (re)start — the mounted DOM is now this
      // conversation's; scanning is safe again.
      domTrusted = true;
      handleDOMChange();
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [SELECTORS.STREAMING_ATTR],
    attributeOldValue: true, // distinguishes streaming-end from initial mount (issue #166)
  });

  // Initial scan — the conversation may already be (partially) rendered when
  // observing starts; later childList mutations cover anything still loading.
  // Skipped when the pre-existing DOM is distrusted (SPA navigation): the
  // panel is fed by hydration until the first mutation proves the new
  // conversation rendered.
  if (domTrusted) handleDOMChange();

  // Restore previously accumulated turns from storage (async; merge order
  // doesn't matter — seeding never overwrites DOM-scanned entries).
  hydrateFromStoredTree();

  // active-node-tracker starts
  startTracking((navId) => {
    usePanelStore.getState().setActiveNode(navId);
  });

  // Separate observer for branch switching (‹/›). mergeMountedNodes reads the
  // settled DOM and drops cached turns past the divergence point, so stale
  // nodes from the previous branch don't linger in the tree.
  branchCleanup = watchBranchChanges(container as HTMLElement, () => {
    currentNodes = mergeMountedNodes();
    dispatchTree(buildTree(currentNodes));
  });
}

export function stopObserving(): void {
  // Cancel any pending debounced scan so it can't dispatch a stale tree
  // after teardown (e.g. mid-SPA-navigation).
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  observer?.disconnect();
  observer = null;
  // Invalidate the session so any in-flight debounce/hydration callback from
  // this conversation can no longer dispatch or persist.
  currentSessionId = null;
  persistReady = false;
  branchCleanup?.();
  branchCleanup = null;
  stopTracking();
}
