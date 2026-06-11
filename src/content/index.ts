// Content Script entry point — initialises all modules on claude.ai.

import { startObserving, stopObserving } from './observer';
import { watchPageChanges } from './page-watcher';
import { injectPanel, destroyPanel } from './ui-injector';
import { CHAT_URL_PATTERN, SELECTORS } from '@shared/constants';

let containerWatch: MutationObserver | null = null;

// claude.ai renders #main-content asynchronously, often after document_idle on
// fast loads, so bootstrap must wait for it instead of assuming it exists.
// Waiting also guarantees the React app has rendered before the panel mounts.
function whenContainerReady(onReady: () => void): void {
  containerWatch?.disconnect();
  containerWatch = null;

  if (document.querySelector(SELECTORS.CHAT_CONTAINER)) {
    onReady();
    return;
  }

  console.log('[ChatTree DBG] waiting for container', SELECTORS.CHAT_CONTAINER);
  containerWatch = new MutationObserver(() => {
    if (!document.querySelector(SELECTORS.CHAT_CONTAINER)) return;
    containerWatch?.disconnect();
    containerWatch = null;
    onReady();
  });
  containerWatch.observe(document.documentElement, { childList: true, subtree: true });
}

function bootstrap(): void {
  stopObserving();
  destroyPanel();
  whenContainerReady(() => {
    console.log('[ChatTree DBG] container ready — injecting panel + observer');
    injectPanel();
    startObserving();
  });
}

function init(): void {
  console.log('[ChatTree DBG] init()', {
    pathname: location.pathname,
    readyState: document.readyState,
  });

  // Step 1 — Register SPA navigation listener first so no URL change is missed.
  watchPageChanges((url) => {
    console.log('[ChatTree DBG] SPA nav → chat page', url);
    bootstrap();
  });

  // Step 2 — If the extension loads while already on a chat page, bootstrap immediately.
  if (CHAT_URL_PATTERN.test(location.pathname)) bootstrap();
}

init();
