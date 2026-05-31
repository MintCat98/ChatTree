// Watches the DOM for new chatbox elements via MutationObserver.
import { assignChatboxIds } from './chatbox-tracker';
import { buildTree } from './chatbox-tracker';
import { SELECTORS, TIMING } from '@shared/constants';
import { MessageType } from '@shared/message-types';

let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function handleDOMChange(): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    const nodes = assignChatboxIds();
    const tree = buildTree(nodes);

    chrome.runtime.sendMessage({
      type: MessageType.CHATBOX_ADDED,
      payload: { nodes, sessionId: tree.sessionId },
    });
  }, TIMING.OBSERVER_DEBOUNCE)
}

export function startObserving(): void {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return;

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Detect branch: BRANCH_ACTIONS_WRAPPER newly added
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement &&
            node.matches(SELECTORS.BRANCH_ACTIONS_WRAPPER)) {
            chrome.runtime.sendMessage({ type: MessageType.BRANCH_CHANGED });
          }
        });
      }

      // Detect end of streaming and manages branch
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
}

export function stopObserving(): void {
  observer?.disconnect();
  observer = null;
}
