// Service Worker entry point — registers the message relay listener.

import { onMessage } from './message-handler';

chrome.runtime.onMessage.addListener(onMessage);

// No per-tab cleanup: trees are keyed by sessionId (issue #152) and must
// outlive individual tabs so new windows can hydrate. chrome.storage.session
// clears itself when the browser closes, which bounds accumulation.

// Keepalive: wake the SW every minute to prevent the 30-second inactivity termination
// from dropping in-flight message handlers between user actions.
chrome.alarms.create('keepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') return;
  // Future alarm handlers go here.
});
