// Scrolls the page to the chatbox element identified by navId.

import { SELECTORS, TIMING } from '../shared/constants';
import { getCachedTop } from './chatbox-tracker';

function highlight(el: Element): void {
  el.classList.add('nav-highlight');
  setTimeout(() => el.classList.remove('nav-highlight'), TIMING.HIGHLIGHT_DURATION);
}

export function scrollToNode(navId: string): void {
  const el = document.querySelector(`[${SELECTORS.NAV_ID_ATTR}="${navId}"]`);

  if (el) {
    const scrollContainer = el.closest<HTMLElement>('div.overflow-y-auto');
    if (scrollContainer) {
      const delta =
        el.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top - 24;
      scrollContainer.scrollBy({ top: delta, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    highlight(el);
    return;
  }

  // Bubble was virtualized out of the DOM — scroll the conversation container
  // to the turn's cached absolute offset; claude.ai remounts it as it comes
  // into view, so re-query afterwards for the highlight.
  const top = getCachedTop(navId);
  const scrollContainer =
    document.querySelector<HTMLElement>(SELECTORS.SCROLL_CONTAINER) ??
    document.querySelector<HTMLElement>('div.overflow-y-auto');

  if (top === null || !scrollContainer) {
    console.warn(`[scroll-navigator] element not found for navId: ${navId}`);
    return;
  }

  scrollContainer.scrollTo({ top: Math.max(top - 24, 0), behavior: 'smooth' });

  setTimeout(() => {
    const mounted = document.querySelector(`[${SELECTORS.NAV_ID_ATTR}="${navId}"]`);
    if (mounted) highlight(mounted);
  }, TIMING.VIRTUAL_SCROLL_SETTLE);
}
