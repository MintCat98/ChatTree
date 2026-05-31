// Service Worker entry point — registers the message relay listener.

import { onMessage } from './message-handler';
import { clearTree } from './session-store';

chrome.runtime.onMessage.addListener(onMessage);

// Auto-cleanup tree data when a tab is closed.
// chrome.tabs.onRemoved does not require the `tabs` permission.
chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTree(tabId);
});
