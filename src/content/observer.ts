// Watches the DOM for new chatbox elements via MutationObserver.
import { assignChatboxIds, buildTree } from './chatbox-tracker';
import { watchBranchChanges } from './branch-change-watcher';
import { sendToBackground } from './message-bridge';
import { SELECTORS, TIMING } from '@shared/constants';
import { MessageType } from '@shared/message-types';
import type { ChatboxNode, TreeData } from '@shared/types';

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
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    currentNodes = assignChatboxIds();
    dispatchTree(buildTree(currentNodes));
  }, TIMING.OBSERVER_DEBOUNCE);
}

export function startObserving(): void {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return;

  currentNodes = [];

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Detect end of streaming
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === SELECTORS.STREAMING_ATTR &&
        (mutation.target as HTMLElement).getAttribute(SELECTORS.STREAMING_ATTR) === 'false'
      ) {
        handleDOMChange();
      }
    }
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [SELECTORS.STREAMING_ATTR],
  });

  // Separate observer for branch switching (‹/›) — full rescan ensures
  // branchCurrent and node text are always read fresh from the settled DOM
  branchCleanup = watchBranchChanges(container as HTMLElement, () => {
    currentNodes = assignChatboxIds();
    dispatchTree(buildTree(currentNodes));
  });
}

export function stopObserving(): void {
  observer?.disconnect();
  observer = null;
  branchCleanup?.();
  branchCleanup = null;
}
