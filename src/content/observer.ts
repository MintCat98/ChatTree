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
  // TODO: implement — create MutationObserver, attach to chat container
  throw new Error('TODO');
}

export function stopObserving(): void {
  // TODO: implement — disconnect and null out observer
  observer?.disconnect();
  observer = null;
}
