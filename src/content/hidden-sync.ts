// Reflects the hidden metadata flag onto the actual conversation DOM.
// One-way: metadata → DOM attribute. The CSS rule keyed off data-nav-hidden
// in content_styles.css hides the turn wrapper. Never removes DOM —
// virtualization anchors and scroll math need the elements to exist even
// when collapsed.

import { SELECTORS } from '@shared/constants';
import { usePanelStore } from './panel/store/panel-store';

const HIDDEN_ATTR = 'data-nav-hidden';

// For each mounted bubble, look up its metadata and toggle the wrapper's
// data-nav-hidden attribute. Bubbles that aren't currently mounted just skip
// — they get re-applied on the next handleDOMChange pass after they remount.
export function applyHiddenState(): void {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return;

  const metadata = usePanelStore.getState().sessionMetadata;
  const bubbles = container.querySelectorAll(`[${SELECTORS.NAV_ID_ATTR}]`);

  bubbles.forEach((el) => {
    const navId = el.getAttribute(SELECTORS.NAV_ID_ATTR);
    if (!navId) return;

    // Hide the whole turn wrapper (user + assistant), not just the bubble.
    // Falls back to the article, then the bubble itself if neither exists.
    const target =
      (el.closest(SELECTORS.TURN_INDEX_WRAPPER) as HTMLElement | null) ??
      (el.closest(SELECTORS.TURN_ARTICLE) as HTMLElement | null) ??
      (el as HTMLElement);

    const hidden = metadata[navId]?.hidden ?? false;
    if (hidden) {
      target.setAttribute(HIDDEN_ATTR, 'true');
    } else {
      target.removeAttribute(HIDDEN_ATTR);
    }
  });
}

// Subscribe to store changes so DOM state follows metadata edits without
// waiting on the DOM observer's debounce. Returns an unsubscribe fn for
// cleanup in stopObserving.
export function startHiddenSync(): () => void {
  // Initial pass — hydration may already have loaded hidden flags before
  // this subscription is wired up.
  applyHiddenState();

  const unsubscribe = usePanelStore.subscribe(() => {
    applyHiddenState();
  });

  return unsubscribe;
}