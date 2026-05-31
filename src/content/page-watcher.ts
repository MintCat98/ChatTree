// Detects SPA navigation on claude.ai and fires a callback on new chat URLs.

import { CHAT_URL_PATTERN } from '@shared/constants';

export function watchPageChanges(onEnter: (url: string) => void): void {
  function checkAndFire(): void {
    if (CHAT_URL_PATTERN.test(location.pathname)) {
      onEnter(location.href);
    }
  }

  // Patch pushState to catch forward navigations (SPA link clicks).
  const originalPushState = history.pushState.bind(history);
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState(...args);
    checkAndFire();
  };

  // popstate fires on back/forward navigation.
  window.addEventListener('popstate', checkAndFire);
}
