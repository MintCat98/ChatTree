// Tracks which chatbox is currently visible in the viewport via IntersectionObserver.

let intersectionObserver: IntersectionObserver | null = null;

export function startTracking(_onActiveChange: (navId: string) => void): void {
  // TODO: implement — create IntersectionObserver watching chatbox elements
  throw new Error('TODO');
}

export function stopTracking(): void {
  intersectionObserver?.disconnect();
  intersectionObserver = null;
}
