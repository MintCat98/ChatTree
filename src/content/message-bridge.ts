// Wraps chrome.runtime messaging between Content Script and Background SW.

import type { ExtensionMessage } from '@shared/message-types';

export function sendToBackground(message: ExtensionMessage): void {
  // TODO: implement — chrome.runtime.sendMessage with error handling
  void message;
  throw new Error('TODO');
}

export function onMessageFromBackground(
  _handler: (message: ExtensionMessage) => void,
): void {
  // TODO: implement — chrome.runtime.onMessage.addListener with type guard
  throw new Error('TODO');
}
