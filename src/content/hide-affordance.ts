// Injects a hover-only "−" hide control into each user message bubble on
// claude.ai. Clicking it flips the corresponding node's metadata.hidden
// flag; the panel and the Phase 1 sync then react automatically.
//
// Same call pattern as InteractiveMap's write sites: patchNodeMetadata
// (store) + setNodeMetadata (storage) side by side, per the shared
// contract other callers follow.

import { SELECTORS } from '@shared/constants';
import { usePanelStore } from './panel/store/panel-store';
import { setNodeMetadata } from '@shared/metadata-storage';

const CONTROL_CLASS = 'nav-hide-control';

// Add the "−" button to a single bubble if it doesn't already have one.
// Idempotent — the class check makes repeated calls (e.g. after
// virtualization remount) safe.
function attachControl(bubble: HTMLElement): void {
  if (bubble.querySelector(`.${CONTROL_CLASS}`)) return;

  const navId = bubble.getAttribute(SELECTORS.NAV_ID_ATTR);
  if (!navId) return;

  // Bubble needs to establish a positioning context so the absolutely
  // positioned button anchors to it. Setting inline is fine — this is the
  // one exception where we own the element enough to add an attribute,
  // but we still prefer a class-based hook so styling lives in CSS.
  if (getComputedStyle(bubble).position === 'static') {
    bubble.style.position = 'relative';
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = CONTROL_CLASS;
  btn.setAttribute('aria-label', 'Hide this turn');
  btn.textContent = '−';

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();

    const sessionId = usePanelStore.getState().tree?.sessionId;
    const patch = { hidden: true };
    usePanelStore.getState().patchNodeMetadata(navId, patch);
    if (sessionId) void setNodeMetadata(sessionId, navId, patch);
  });

  bubble.appendChild(btn);
}

// Walk all currently mounted bubbles and ensure each has a control.
// Called on initial scan and after every DOM rescan (virtualization
// remounts, streaming completion, branch switches).
export function applyHideControls(): void {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return;

  const bubbles = container.querySelectorAll<HTMLElement>(
    `[${SELECTORS.NAV_ID_ATTR}]`,
  );
  bubbles.forEach(attachControl);
}