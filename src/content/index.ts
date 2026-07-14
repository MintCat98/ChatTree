// Content Script entry point — initialises all modules on claude.ai.

import { startObserving, stopObserving } from './observer';
import { watchPageChanges } from './page-watcher';
import { injectPanel, destroyPanel, isPanelMounted, getResolvedTheme } from './ui-injector';
import { CHAT_URL_PATTERN, SELECTORS } from '@shared/constants';
import { MessageType } from '@shared/message-types';

let containerWatch: MutationObserver | null = null;

// claude.ai renders the chat container asynchronously, often after document_idle
// on fast loads, so bootstrap must wait for it instead of assuming it exists.
// Waiting also guarantees the React app has rendered before the panel mounts.
function whenContainerReady(onReady: () => void): void {
  containerWatch?.disconnect();
  containerWatch = null;

  if (document.querySelector(SELECTORS.CHAT_CONTAINER)) {
    onReady();
    return;
  }

  // console.log('[ChatTree DBG] waiting for container', SELECTORS.CHAT_CONTAINER);
  containerWatch = new MutationObserver(() => {
    if (!document.querySelector(SELECTORS.CHAT_CONTAINER)) return;
    containerWatch?.disconnect();
    containerWatch = null;
    onReady();
  });
  containerWatch.observe(document.documentElement, { childList: true, subtree: true });
}

// trustExistingDom: false on SPA navigation — the previous conversation's DOM
// can still be mounted when the container check passes, and scanning it would
// corrupt the new conversation's hydrated cache (see observer.ts).
function bootstrap(trustExistingDom = true): void {
  stopObserving();
  destroyPanel();
  whenContainerReady(() => {
    // console.log('[ChatTree DBG] container ready — injecting panel + observer');
    injectPanel();
    startObserving({ trustExistingDom });
  });
}

function ensureActive(): void {
  if (CHAT_URL_PATTERN.test(location.pathname) && !isPanelMounted()) bootstrap();
}

function init(): void {
  // console.log('[ChatTree DBG] init()', {
  //   pathname: location.pathname,
  //   readyState: document.readyState,
  // });

  // Step 1 — Register SPA navigation listener first so no URL change is missed.
  watchPageChanges((url) => {
    // console.log('[ChatTree DBG] SPA nav → chat page', url);
    bootstrap(false);
  });

  // Step 2 — If the extension loads while already on a chat page, bootstrap immediately.
  if (CHAT_URL_PATTERN.test(location.pathname)) bootstrap();

  // Step 3 - If background new tab is appeared
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ensureActive();
  });

  // Step 4 - When session is restored, ensure the panel is mounted
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) ensureActive();
  });
}

// Respond to popup queries for the current resolved theme.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === MessageType.GET_RESOLVED_THEME) {
    sendResponse({ theme: getResolvedTheme() });
    return false;
  }
});

init();
