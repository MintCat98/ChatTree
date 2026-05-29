// Content Script entry point — initialises all modules on claude.ai.

import { startObserving, stopObserving } from './observer';
import { watchPageChanges } from './page-watcher';
import { injectPanel, destroyPanel } from './ui-injector';
import { CHAT_URL_PATTERN } from '@shared/constants';
//import './_test-tracker';

function onChatPageEntered(): void {
  // TODO: reset Tracker, update session ID, re-start observing
  destroyPanel();
  injectPanel();
  startObserving();
}

function init(): void {
  // Step 1 — Register SPA navigation listener first so no URL change is missed.
  watchPageChanges((_url) => {
    onChatPageEntered();
  });

  // Step 2 — If the extension loads while already on a chat page, bootstrap immediately.
  if (CHAT_URL_PATTERN.test(location.pathname)) {
    injectPanel();
    startObserving();
  }

  // Step 3 — On subsequent navigations, onChatPageEntered handles teardown + re-init.
  //           stopObserving() is called inside destroyPanel flow (see ui-injector.ts TODO).
  void stopObserving; // referenced here to satisfy import; wired in destroyPanel
}

init();
