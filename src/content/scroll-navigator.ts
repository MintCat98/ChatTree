// Scrolls the page to the chatbox element identified by navId.

import { SELECTORS, TIMING } from '../shared/constants';

export function scrollToNode(navId: string): void {
  const el = document.querySelector(`[${SELECTORS.NAV_ID_ATTR}="${navId}"]`);

  if (!el) {
    console.warn(`[scroll-navigator] element not found for navId: ${navId}`);
    return;
  }

  const scrollContainer = el.closest<HTMLElement>('div.overflow-y-auto');
  if (scrollContainer) {
    const delta =
      el.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top - 24;
    scrollContainer.scrollBy({ top: delta, behavior: 'smooth' });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  el.classList.add('nav-highlight');
  setTimeout(() => el.classList.remove('nav-highlight'), TIMING.HIGHLIGHT_DURATION);
}
