// Wraps chrome.runtime messaging between Content Script and Background SW.

import type { BridgeMessage } from '@shared/message-types';

export function sendToBackground(message: BridgeMessage): void {
  // TODO: implement — chrome.runtime.sendMessage with error handling
  void message;
  throw new Error('TODO');
}

export function onMessageFromBackground(
  _handler: (message: BridgeMessage) => void,
): void {
  // TODO: implement — chrome.runtime.onMessage.addListener with type guard
  throw new Error('TODO');
}
