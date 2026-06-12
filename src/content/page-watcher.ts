// Detects SPA navigation on claude.ai and fires a callback on new chat URLs.
//
// Patching history.pushState does NOT work here: content scripts run in an
// isolated world, so the page's own pushState calls never reach the patched
// binding. The Navigation API does fire in isolated worlds, so use it instead.

import { CHAT_URL_PATTERN } from '@shared/constants';

export function watchPageChanges(onEnter: (url: string) => void): void {
  let lastPathname = location.pathname;

  function checkAndFire(): void {
    if (location.pathname === lastPathname) return;
    lastPathname = location.pathname;
    if (CHAT_URL_PATTERN.test(location.pathname)) {
      onEnter(location.href);
    }
  }

  const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
  if (navigation) {
    // Fires after any same-document navigation (pushState included) completes.
    navigation.addEventListener('navigatesuccess', checkAndFire);
  } else {
    // No Navigation API (Chrome < 102) — poll as a last resort.
    setInterval(checkAndFire, 1000);
  }

  // Back/forward navigation.
  window.addEventListener('popstate', checkAndFire);
}
