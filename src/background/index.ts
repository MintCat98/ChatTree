// Service Worker entry point — registers the message relay listener.

import { onMessage } from './message-handler';
import { clearTree } from './session-store';

chrome.runtime.onMessage.addListener(onMessage);

// Auto-cleanup tree data when a tab is closed.
// chrome.tabs.onRemoved does not require the `tabs` permission.
chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTree(tabId);
});

// Keepalive: wake the SW every minute to prevent the 30-second inactivity termination
// from dropping in-flight message handlers between user actions.
chrome.alarms.create('keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') return;
  // Future alarm handlers go here.
});
