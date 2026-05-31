// Watches the DOM for new chatbox elements via MutationObserver.
import { assignChatboxIds, buildTree, reloadFromNode } from './chatbox-tracker';
import { watchBranchChanges } from './branch-change-watcher';
import { SELECTORS, TIMING } from '@shared/constants';
import { MessageType } from '@shared/message-types';
import type { ChatboxNode } from '@shared/types';

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentNodes: ChatboxNode[] = [];
let branchCleanup: (() => void) | null = null;

function handleDOMChange(): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    currentNodes = assignChatboxIds();
    const tree = buildTree(currentNodes);

    chrome.runtime.sendMessage({
      type: MessageType.CHATBOX_ADDED,
      payload: { nodes: currentNodes, sessionId: tree.sessionId },
    });
  }, TIMING.OBSERVER_DEBOUNCE);
}

export function startObserving(): void {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return;

  currentNodes = [];

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Detect new branch creation: BRANCH_ACTIONS_WRAPPER newly added to DOM
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement &&
            node.matches(SELECTORS.BRANCH_ACTIONS_WRAPPER)) {
            chrome.runtime.sendMessage({ type: MessageType.BRANCH_CHANGED });
          }
        });
      }

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

  // Separate observer for branch switching (‹/›) — detects indicator text changes
  branchCleanup = watchBranchChanges(container as HTMLElement, (navId) => {
    currentNodes = reloadFromNode(navId, currentNodes);
    const tree = buildTree(currentNodes);
    chrome.runtime.sendMessage({
      type: MessageType.BRANCH_CHANGED,
      payload: { nodes: currentNodes, sessionId: tree.sessionId },
    });
  });
}

export function stopObserving(): void {
  observer?.disconnect();
  observer = null;
  branchCleanup?.();
  branchCleanup = null;
}
