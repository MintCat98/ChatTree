// Detects ‹/› branch button clicks via event delegation to trigger tree reload.
// Uses DOM-settle detection (mutation quiesce) rather than a fixed timeout so
// the callback fires only after React has finished re-rendering the new branch.

import { SELECTORS, TIMING } from '@shared/constants';

export function watchBranchChanges(
  container: HTMLElement,
  onBranchChange: () => void,
): () => void {
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let settleObserver: MutationObserver | null = null;
  let pendingChange = false;

  const fireIfPending = () => {
    if (!pendingChange) return;
    pendingChange = false;
    if (!document.querySelector(SELECTORS.STREAMING_INDICATOR)) {
      onBranchChange();
    }
  };

  const startSettle = () => {
    // Reset any in-flight settle cycle
    if (settleTimer) clearTimeout(settleTimer);
    settleObserver?.disconnect();

    // Watch for DOM mutations; once they stop for 50 ms, the branch render is done
    settleObserver = new MutationObserver(() => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        settleTimer = null;
        settleObserver?.disconnect();
        settleObserver = null;
        fireIfPending();
      }, 50);
    });

    settleObserver.observe(container, { childList: true, subtree: true, characterData: true });

    // Fallback: if no mutations or they never stop, fire after BRANCH_CHANGE_DEBOUNCE ms
    settleTimer = setTimeout(() => {
      settleTimer = null;
      settleObserver?.disconnect();
      settleObserver = null;
      fireIfPending();
    }, TIMING.BRANCH_CHANGE_DEBOUNCE);
  };

  const handleClick = (event: Event) => {
    const target = event.target as HTMLElement;
    const btn = target.closest(`${SELECTORS.BRANCH_PREV_BTN}, ${SELECTORS.BRANCH_NEXT_BTN}`);
    if (!btn) return;

    pendingChange = true;
    startSettle();
  };

  container.addEventListener('click', handleClick);

  return () => {
    container.removeEventListener('click', handleClick);
    settleObserver?.disconnect();
    if (settleTimer) clearTimeout(settleTimer);
  };
}
