// Tracks which chatbox is currently visible in the viewport via IntersectionObserver.

import { SELECTORS, TIMING } from '@shared/constants';
import { MessageType } from '@shared/message-types';

let intersectionObserver: IntersectionObserver | null = null;
const visibleNodes = new Map<string, number>();
let throttleTimer: ReturnType<typeof setTimeout> | null = null;

export function startTracking(_onActiveChange: (navId: string) => void): void {
  if (intersectionObserver) stopTracking();

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const navId = entry.target.getAttribute(SELECTORS.NAV_ID_ATTR);
        if (!navId) continue;

        if (entry.isIntersecting) {
          visibleNodes.set(navId, entry.intersectionRatio);
        } else {
          visibleNodes.delete(navId);
        }
      }

      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;

        let bestId: string | null = null;
        let bestRatio = -1;

        for (const [navId, ratio] of visibleNodes) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = navId;
          }
        }

        if (bestId) {
          console.log(MessageType.ACTIVE_NODE_CHANGED, bestId);
          _onActiveChange(bestId);
        }
      }, 50);
    },
    {
      threshold: TIMING.INTERSECTION_THRESHOLD,
    }
  );

  document
    .querySelectorAll(`[${SELECTORS.NAV_ID_ATTR}]`)
    .forEach((el) => intersectionObserver!.observe(el));
}

export function stopTracking(): void {
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  visibleNodes.clear();

  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
}

export function observeNode(el: Element): void {
  intersectionObserver?.observe(el);
}
