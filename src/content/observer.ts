// Watches the DOM for new chatbox elements via MutationObserver.

let observer: MutationObserver | null = null;

export function startObserving(): void {
  // TODO: implement — create MutationObserver, attach to chat container
  throw new Error('TODO');
}

export function stopObserving(): void {
  // TODO: implement — disconnect and null out observer
  observer?.disconnect();
  observer = null;
}
