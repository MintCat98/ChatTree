// Handles all messages between Content Script, Panel, and Popup.

import type { BridgeMessage } from '@shared/message-types';

export function onMessage(
  _message: BridgeMessage,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): boolean | void {
  // TODO: implement message relay logic per MessageType
}
