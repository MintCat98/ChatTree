// Scrolls the page to the chatbox element identified by navId.

import { SELECTORS, TIMING } from '../shared/constants';
import { getCachedTop, absIndexFromNavId } from './chatbox-tracker';

function highlight(el: Element): void {
  el.classList.add('nav-highlight');
  setTimeout(() => el.classList.remove('nav-highlight'), TIMING.HIGHLIGHT_DURATION);
}

function findScrollContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(SELECTORS.SCROLL_CONTAINER) ??
    document.querySelector<HTMLElement>('div.overflow-y-auto')
  );
}

// Proportional estimate for turns whose exact offset was never captured
// (hydrated from storage, issue #152): absIndex / total turns × scroll height.
// aria-setsize on any mounted [role="article"] gives the total turn count.
function estimateTop(navId: string, container: HTMLElement): number | null {
  const absIndex = absIndexFromNavId(navId);
  if (absIndex === null) return null;

  const article = document.querySelector(`${SELECTORS.TURN_ARTICLE}[aria-setsize]`);
  const setsize = parseInt(article?.getAttribute('aria-setsize') ?? '', 10);
  if (isNaN(setsize) || setsize <= 0) return null;

  return (absIndex / setsize) * container.scrollHeight;
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
  // to the turn's cached absolute offset (or a proportional estimate for
  // hydrated turns). claude.ai remounts it as it comes into view, so re-query
  // afterwards to correct the position and apply the highlight.
  const scrollContainer = findScrollContainer();
  if (!scrollContainer) {
    console.warn(`[scroll-navigator] element not found for navId: ${navId}`);
    return;
  }

  const top = getCachedTop(navId) ?? estimateTop(navId, scrollContainer);
  if (top === null) {
    console.warn(`[scroll-navigator] element not found for navId: ${navId}`);
    return;
  }

  scrollContainer.scrollTo({ top: Math.max(top - 24, 0), behavior: 'smooth' });

  setTimeout(() => {
    const mounted = document.querySelector(`[${SELECTORS.NAV_ID_ATTR}="${navId}"]`);
    if (!mounted) return;
    // Correction pass — estimates land near, not on, the target.
    const delta =
      mounted.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top - 24;
    if (Math.abs(delta) > 4) scrollContainer.scrollBy({ top: delta, behavior: 'smooth' });
    highlight(mounted);
  }, TIMING.VIRTUAL_SCROLL_SETTLE);
}

// Jump to the very top of the conversation — used by the panel's
// "earlier messages" ghost row (issue #152). Scrolling up makes claude.ai
// mount the earliest turns, which the observer then scans into the tree.
export function scrollToConversationTop(): void {
  findScrollContainer()?.scrollTo({ top: 0, behavior: 'smooth' });
}
