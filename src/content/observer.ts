// Watches the DOM for new chatbox elements via MutationObserver.
import { mergeMountedNodes, resetNodeCache, buildTree } from './chatbox-tracker';
import { watchBranchChanges } from './branch-change-watcher';
import { sendToBackground } from './message-bridge';
import { SELECTORS, TIMING } from '@shared/constants';
import { MessageType } from '@shared/message-types';
import type { ChatboxNode, TreeData } from '@shared/types';
import { startTracking, stopTracking, observeNode } from './active-node-tracker';
import { usePanelStore } from './panel/store/panel-store';

export const TREE_READY_EVENT = 'chattree:ready';

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentNodes: ChatboxNode[] = [];
let branchCleanup: (() => void) | null = null;

function dispatchTree(tree: TreeData): void {
  window.dispatchEvent(new CustomEvent(TREE_READY_EVENT, { detail: { tree } }));
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

export function startObserving(): void {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  // console.log('[ChatTree DBG] startObserving — container found?', !!container, 'selector=', SELECTORS.CHAT_CONTAINER);
  if (!container) return;

  currentNodes = [];
  resetNodeCache(); // fresh conversation — accumulated turns belong to the old one

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Chatboxes mount as childList additions — opening an existing
      // conversation never flips the streaming attribute, so element
      // changes must trigger a rescan too. Debounce absorbs the churn.
      if (
        mutation.type === 'childList' &&
        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
      ) {
        handleDOMChange();
        break;
      }
      // End of streaming — the settled DOM is the authoritative state.
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === SELECTORS.STREAMING_ATTR &&
        (mutation.target as HTMLElement).getAttribute(SELECTORS.STREAMING_ATTR) === 'false'
      ) {
        handleDOMChange();
        break;
      }
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [SELECTORS.STREAMING_ATTR],
  });

  // Initial scan — the conversation may already be (partially) rendered when
  // observing starts; later childList mutations cover anything still loading.
  handleDOMChange();

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
  branchCleanup?.();
  branchCleanup = null;
  stopTracking();
}
