// Service Worker entry point — registers the message relay listener.

import { onMessage } from './message-handler';
import { purgeExpiredTrees } from './session-store';

chrome.runtime.onMessage.addListener(onMessage);

// No per-tab cleanup: trees are keyed by sessionId (issue #152) and must
// outlive individual tabs so new windows can hydrate. Trees live in
// chrome.storage.local (issue #153); accumulation is bounded by the
// retention-policy purge.

// Keepalive: wake the SW every minute to prevent the 30-second inactivity termination
// from dropping in-flight message handlers between user actions.
chrome.alarms.create('keepalive', { periodInMinutes: 1 });

// Daily purge of expired cached trees (issue #153). chrome.alarms, not
// setTimeout — MV3 forbids long-lived timers in the SW.
chrome.alarms.create('tree-cache-purge', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') return;
  if (alarm.name === 'tree-cache-purge') {
    purgeExpiredTrees().catch((err) => console.warn('[ChatTree] tree purge failed:', err));
  }
});

// Purge once on browser startup so trees that expired while the browser was
// closed don't hydrate one last time before the daily alarm removes them.
chrome.runtime.onStartup.addListener(() => {
  purgeExpiredTrees().catch((err) => console.warn('[ChatTree] tree purge failed:', err));
});
