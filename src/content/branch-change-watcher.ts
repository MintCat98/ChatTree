// Watches for branch-indicator text changes to detect ‹/› button clicks.

import { SELECTORS, TIMING } from '@shared/constants';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Attaches a MutationObserver that fires onBranchChange(navId) when the user
 * switches branches via ‹/›. Returns a cleanup function.
 *
 * Detection path:
 *   Text node → span[BRANCH_INDICATOR] → closest(BRANCH_ACTIONS_WRAPPER)
 *   → parentElement (shared container) → querySelector(USER_MESSAGE_BUBBLE) → data-nav-id
 */
export function watchBranchChanges(
  container: HTMLElement,
  onBranchChange: (navId: string) => void,
): () => void {
  const observer = new MutationObserver((mutations) => {
    // Ignore all events while AI is streaming
    if (document.querySelector('[data-testid="streaming-indicator"]')) return;

    for (const mutation of mutations) {
      if (mutation.type !== 'characterData') continue;

      const parent = (mutation.target as Text).parentElement;
      if (!parent?.matches(SELECTORS.BRANCH_INDICATOR)) continue;

      // BRANCH_ACTIONS_WRAPPER is a sibling of USER_MESSAGE_BUBBLE under the same parent
      const wrapper = parent.closest(SELECTORS.BRANCH_ACTIONS_WRAPPER);
      const bubble = wrapper?.parentElement?.querySelector(SELECTORS.USER_MESSAGE_BUBBLE) as HTMLElement | null;
      const navId = bubble?.getAttribute(SELECTORS.NAV_ID_ATTR);
      if (!navId) continue;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onBranchChange(navId), TIMING.BRANCH_CHANGE_DEBOUNCE);
    }
  });

  observer.observe(container, { subtree: true, characterData: true });

  return () => {
    observer.disconnect();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };
}
