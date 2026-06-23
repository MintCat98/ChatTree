/**
 * @jest-environment jsdom
 */
// Unit tests for watchBranchChanges — branch-switch detection via click delegation + DOM-settle.

import { watchBranchChanges } from '@content/branch-change-watcher';
import { SELECTORS } from '@shared/constants';

let capturedSettleCallback: ((mutations: MutationRecord[]) => void) | null = null;
let mockSettleObserver: { observe: jest.Mock; disconnect: jest.Mock };
let registeredClickHandler: ((event: Event) => void) | null = null;

// Minimal mock container — only needs addEventListener / removeEventListener
const mockContainer = {
  addEventListener: jest.fn((type: string, fn: (e: Event) => void) => {
    if (type === 'click') registeredClickHandler = fn;
  }),
  removeEventListener: jest.fn(),
} as unknown as HTMLElement;

// Simulates a click whose target.closest() returns a branch button element
function clickBranchBtn(): void {
  registeredClickHandler!({ target: { closest: () => ({}) } } as unknown as Event);
}

// Simulates a click on a non-branch target
function clickNonBranchBtn(): void {
  registeredClickHandler!({ target: { closest: () => null } } as unknown as Event);
}

beforeEach(() => {
  jest.useFakeTimers();
  capturedSettleCallback = null;
  registeredClickHandler = null;
  (mockContainer.addEventListener as jest.Mock).mockClear();
  (mockContainer.removeEventListener as jest.Mock).mockClear();

  const MockObserver = jest.fn((cb: (m: MutationRecord[]) => void) => {
    capturedSettleCallback = cb;
    mockSettleObserver = { observe: jest.fn(), disconnect: jest.fn() };
    return mockSettleObserver;
  });
  (global as Record<string, unknown>).MutationObserver = MockObserver;

  jest.spyOn(document, 'querySelector').mockReturnValue(null);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('watchBranchChanges', () => {
  it('attaches a click listener to the given container', () => {
    watchBranchChanges(mockContainer, jest.fn());
    expect(mockContainer.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('fires callback via fallback timer when no DOM mutations arrive', () => {
    const cb = jest.fn();
    watchBranchChanges(mockContainer, cb);

    clickBranchBtn();
    expect(cb).not.toHaveBeenCalled();

    jest.advanceTimersByTime(150); // TIMING.BRANCH_CHANGE_DEBOUNCE
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires callback after DOM settles (50 ms quiesce after last mutation)', () => {
    const cb = jest.fn();
    watchBranchChanges(mockContainer, cb);

    clickBranchBtn();
    capturedSettleCallback!([{} as MutationRecord]); // simulate a DOM mutation
    expect(cb).not.toHaveBeenCalled();

    jest.advanceTimersByTime(50); // quiesce window
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire if streaming is active when the settle completes', () => {
    jest.spyOn(document, 'querySelector').mockImplementation((sel) =>
      sel === SELECTORS.STREAMING_INDICATOR ? ({} as Element) : null,
    );
    const cb = jest.fn();
    watchBranchChanges(mockContainer, cb);

    clickBranchBtn();
    jest.advanceTimersByTime(200);

    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores clicks not on branch buttons', () => {
    const cb = jest.fn();
    watchBranchChanges(mockContainer, cb);

    clickNonBranchBtn();
    jest.advanceTimersByTime(200);

    expect(cb).not.toHaveBeenCalled();
  });

  it('resets the in-flight settle on rapid successive clicks', () => {
    const cb = jest.fn();
    watchBranchChanges(mockContainer, cb);

    clickBranchBtn();
    jest.advanceTimersByTime(100); // mid-settle
    clickBranchBtn(); // second click — resets the settle cycle
    jest.advanceTimersByTime(150);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('cleanup removes the click listener and suppresses any pending callback', () => {
    const cb = jest.fn();
    const cleanup = watchBranchChanges(mockContainer, cb);

    clickBranchBtn();
    cleanup();
    jest.advanceTimersByTime(200);

    expect(mockContainer.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    expect(cb).not.toHaveBeenCalled();
  });
});
