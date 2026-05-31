// Unit tests for watchBranchChanges — branch-switch detection via characterData.

import { watchBranchChanges } from '@content/branch-change-watcher';
import { SELECTORS } from '@shared/constants';

// Captured MutationObserver internals
let capturedCallback: ((mutations: MutationRecord[]) => void) | null = null;
let mockObserver: { observe: jest.Mock; disconnect: jest.Mock };

// Helper: build a fake characterData MutationRecord that looks like a
// branch-indicator text node sitting inside BRANCH_ACTIONS_WRAPPER,
// whose sibling USER_MESSAGE_BUBBLE carries the given navId.
function makeBranchMutation(navId: string): MutationRecord {
  const attrs: Record<string, string> = { 'data-nav-id': navId };
  const bubble = {
    getAttribute: (k: string) => attrs[k] ?? null,
    matches: () => false,
  };
  const sharedParent = { querySelector: () => bubble };
  const wrapper = { parentElement: sharedParent };

  // span that matches SELECTORS.BRANCH_INDICATOR
  const indicatorSpan = {
    matches: (sel: string) => sel === SELECTORS.BRANCH_INDICATOR,
    closest: () => wrapper,
  };
  const textNode = { parentElement: indicatorSpan };

  return { type: 'characterData', target: textNode } as unknown as MutationRecord;
}

beforeEach(() => {
  jest.useFakeTimers();
  capturedCallback = null;

  const MockObserver = jest.fn((cb: (m: MutationRecord[]) => void) => {
    capturedCallback = cb;
    mockObserver = { observe: jest.fn(), disconnect: jest.fn() };
    return mockObserver;
  });
  (global as Record<string, unknown>).MutationObserver = MockObserver;

  // Default: not streaming
  (global as Record<string, unknown>).document = {
    querySelector: jest.fn(() => null),
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('watchBranchChanges', () => {
  it('calls onBranchChange with the navId after 150ms debounce', () => {
    const cb = jest.fn();
    watchBranchChanges({} as HTMLElement, cb);

    capturedCallback!([makeBranchMutation('chatbox-1')]);
    expect(cb).not.toHaveBeenCalled();

    jest.advanceTimersByTime(150);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('chatbox-1');
  });

  it('debounces rapid events — fires callback only once', () => {
    const cb = jest.fn();
    watchBranchChanges({} as HTMLElement, cb);

    capturedCallback!([makeBranchMutation('chatbox-1')]);
    jest.advanceTimersByTime(50);
    capturedCallback!([makeBranchMutation('chatbox-1')]);
    jest.advanceTimersByTime(50);
    capturedCallback!([makeBranchMutation('chatbox-1')]);
    jest.advanceTimersByTime(150);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire during streaming', () => {
    (document.querySelector as jest.Mock).mockImplementation((sel: string) =>
      sel === '[data-testid="streaming-indicator"]' ? {} : null,
    );
    const cb = jest.fn();
    watchBranchChanges({} as HTMLElement, cb);

    capturedCallback!([makeBranchMutation('chatbox-1')]);
    jest.advanceTimersByTime(200);

    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores non-characterData mutation types', () => {
    const cb = jest.fn();
    watchBranchChanges({} as HTMLElement, cb);

    capturedCallback!([{ type: 'childList', target: {} } as unknown as MutationRecord]);
    jest.advanceTimersByTime(200);

    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores mutations whose parent does not match BRANCH_INDICATOR', () => {
    const cb = jest.fn();
    watchBranchChanges({} as HTMLElement, cb);

    const mutation = {
      type: 'characterData',
      target: {
        parentElement: {
          matches: () => false, // not a branch indicator span
          closest: () => null,
        },
      },
    } as unknown as MutationRecord;

    capturedCallback!([mutation]);
    jest.advanceTimersByTime(200);

    expect(cb).not.toHaveBeenCalled();
  });

  it('cleanup disconnects the observer and cancels a pending timer', () => {
    const cb = jest.fn();
    const cleanup = watchBranchChanges({} as HTMLElement, cb);

    capturedCallback!([makeBranchMutation('chatbox-1')]);
    cleanup();
    jest.advanceTimersByTime(200);

    expect(mockObserver.disconnect).toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled(); // timer was cancelled
  });

  it('attaches the observer to the given container', () => {
    const container = {} as HTMLElement;
    watchBranchChanges(container, jest.fn());
    expect(mockObserver.observe).toHaveBeenCalledWith(container, {
      subtree: true,
      characterData: true,
    });
  });
});
