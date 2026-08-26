// Injects a hover-only "−" hide control into each user message bubble on
// claude.ai. Clicking it flips the corresponding node's metadata.hidden
// flag; the panel and the Phase 1 sync then react automatically.
//
// Same call pattern as InteractiveMap's write sites: patchNodeMetadata
// (store) + setNodeMetadata (storage) side by side, per the shared
// contract other callers follow.

import { SELECTORS } from '@shared/constants';
import { usePanelStore } from './panel/store/panel-store';
import { setNodeMetadata, setNodeMetadataBatch } from '@shared/metadata-storage';

const CONTROL_CLASS = 'nav-hide-control';
const EXPANDER_CLASS = 'nav-expander-strip';

// ─── − control ─────────────────────────────────────────────────────────

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

// ─── + n expander ──────────────────────────────────────────────────────

// Find each maximal run of contiguous hidden turns. Returns arrays of
// nav-ids per run in document order.
function findHiddenRuns(): string[][] {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return [];

  const metadata = usePanelStore.getState().sessionMetadata;
  const bubbles = Array.from(
    container.querySelectorAll<HTMLElement>(`[${SELECTORS.NAV_ID_ATTR}]`),
  );

  const runs: string[][] = [];
  let current: string[] = [];

  for (const bubble of bubbles) {
    const navId = bubble.getAttribute(SELECTORS.NAV_ID_ATTR);
    if (!navId) continue;

    if (metadata[navId]?.hidden) {
      current.push(navId);
    } else if (current.length > 0) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length > 0) runs.push(current);

  return runs;
}

// The wrapper we insert the expander before — the [data-index] ancestor
// of the first bubble in the run. Falls back to the article wrapper, then
// the bubble itself. Matches Phase 1's hide target.
function anchorFor(navId: string): HTMLElement | null {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return null;
  const bubble = container.querySelector<HTMLElement>(
    `[${SELECTORS.NAV_ID_ATTR}="${navId}"]`,
  );
  if (!bubble) return null;
  return (
    (bubble.closest(SELECTORS.TURN_INDEX_WRAPPER) as HTMLElement | null) ??
    (bubble.closest(SELECTORS.TURN_ARTICLE) as HTMLElement | null) ??
    bubble
  );
}

function buildExpander(runIds: string[]): HTMLElement {
  const strip = document.createElement('div');
  strip.className = EXPANDER_CLASS;
  strip.dataset.navRun = runIds.join(',');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = `+ ${runIds.length}`;
  btn.setAttribute(
    'aria-label',
    `Expand ${runIds.length} hidden turn${runIds.length === 1 ? '' : 's'}`,
  );

  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();

    const { patchNodeMetadata, tree } = usePanelStore.getState();
    const sessionId = tree?.sessionId;

    // Update store per-node (cheap, in-memory), storage in one batched
    // write to avoid the race that N parallel setNodeMetadata calls hit.
    for (const id of runIds) {
      patchNodeMetadata(id, { hidden: false });
    }
    if (sessionId) {
      void setNodeMetadataBatch(sessionId, runIds, { hidden: false });
    }
  });

  strip.appendChild(btn);
  return strip;
}

export function applyExpanders(): void {
  const runs = findHiddenRuns();
  const wantedKeys = new Set(runs.map((run) => run.join(',')));

  // Remove only stale expanders.
  document.querySelectorAll<HTMLElement>(`.${EXPANDER_CLASS}`).forEach((el) => {
    const key = el.dataset.navRun ?? '';
    if (!wantedKeys.has(key)) el.remove();
  });

  // Add only missing ones.
  for (const run of runs) {
    const key = run.join(',');
    const existing = document.querySelector<HTMLElement>(
      `.${EXPANDER_CLASS}[data-nav-run="${CSS.escape(key)}"]`,
    );
    if (existing) continue;

    const firstId = run[0];
    const anchor = anchorFor(firstId);
    if (!anchor || !anchor.parentElement) continue;
    const strip = buildExpander(run);
    anchor.parentElement.insertBefore(strip, anchor);
  }
}

// ─── combined pass ─────────────────────────────────────────────────────

// Convenience: run both refresh passes together after a DOM change or
// metadata update. Order matters: expanders depend on metadata + current
// bubble positions, and controls don't care about expanders, so either
// order works, but we do controls first so newly-mounted bubbles get
// their button before expanders shuffle them.
export function refreshHideAffordances(): void {
  applyHideControls();
  applyExpanders();
}