// Scrolls the page to the chatbox element identified by navId.

import { SELECTORS } from '../shared/constants';

export function scrollToNode(navId: string): void {
  const el = document.querySelector(`[${SELECTORS.NAV_ID_ATTR}="${navId}"]`);

  if (!el) return;

  el.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  el.classList.add('nav-highlight');
  setTimeout(() => el.classList.remove('nav-highlight'), 1500);
}
