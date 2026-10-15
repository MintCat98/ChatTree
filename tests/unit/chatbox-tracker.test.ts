// Unit tests for reloadFromNode — partial tree reload after a branch switch.

import {
  assignChatboxIds,
  mergeMountedNodes,
  getCachedNodes,
  resetNodeCache,
  seedNodeCache,
  getCachedTop,
  getCachedAnswer,
  absIndexFromNavId,
  reloadFromNode,
  mutationsMountTurn,
  mountedDomMatchesCache,
  detectBranch,
} from '@content/chatbox-tracker';
import type { ChatboxNode } from '@shared/types';
import { SELECTORS } from '@shared/constants';

// --- minimal DOM fakes ---

type FakeArticle = { getAttribute: (k: string) => string | null };

type FakeEl = {
  getAttribute: (k: string) => string | null;
  setAttribute: (k: string, v: string) => void;
  querySelector: (sel: string) => { textContent: string } | null;
  closest: (sel: string) => unknown;
  // detectBranch looks for the actions wrapper on the parent. null → no
  // wrapper → hasBranch: false, 1 / 1.
  parentElement: { querySelector: (sel: string) => unknown } | null;
  // The '[role="article"]' ancestor carrying aria-setsize — stamped by
  // makeDocument, since the turn count belongs to the conversation.
  article: FakeArticle | null;
};

// Bubble without virtualization ancestors — getAbsolutePosition falls back to
// DOM order. Pass absIndex/top to fake the '[data-index]' wrapper. `inert`
// places the bubble inside the stale-nav frame (closest('[inert]') hits).
// `branch` is the indicator text ("2 / 3") shown in the actions wrapper.
function makeBubble(
  navId: string | null,
  text: string,
  absIndex?: number,
  top?: number,
  opts: { inert?: boolean; branch?: string } = {},
): FakeEl {
  const attrs: Record<string, string> = navId ? { 'data-nav-id': navId } : {};
  const indicator = opts.branch === undefined ? null : { textContent: opts.branch };
  const parentElement =
    opts.branch === undefined
      ? null
      : {
          querySelector: (sel: string) =>
            sel === SELECTORS.BRANCH_ACTIONS_WRAPPER
              ? { querySelector: (s: string) => (s === SELECTORS.BRANCH_INDICATOR ? indicator : null) }
              : null,
        };
  const wrapper =
    absIndex === undefined
      ? null
      : {
          getAttribute: (k: string) => (k === 'data-index' ? String(absIndex) : null),
          style: { top: top === undefined ? '' : `${top}px` },
        };
  const el: FakeEl = {
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: (k, v) => { attrs[k] = v; },
    querySelector: (sel) =>
      sel === '[data-testid="user-message"]' ? { textContent: text } : null,
    closest: (sel) => {
      if (sel === '[data-index]') return wrapper;
      if (sel === SELECTORS.TURN_ARTICLE) return el.article;
      if (sel === SELECTORS.INERT_FRAME) return opts.inert ? {} : null;
      return null;
    },
    parentElement,
    article: null,
  };
  return el;
}

// Assistant answer element (`.font-claude-response`). `texts` becomes the
// nested `.standard-markdown` blocks; `streaming` makes the closest()
// lookup for '[data-is-streaming="true"]' hit, which suppresses the read.
type FakeAnswer = {
  closest: (sel: string) => unknown;
  querySelectorAll: (sel: string) => Array<{ textContent: string }>;
};

function makeAnswer(texts: string[], streaming = false, inert = false): FakeAnswer {
  return {
    closest: (sel) => {
      if (streaming && sel === `[${SELECTORS.STREAMING_ATTR}="true"]`) return {};
      if (inert && sel === SELECTORS.INERT_FRAME) return {};
      return null;
    },
    querySelectorAll: (sel) =>
      sel === SELECTORS.RESPONSE_MARKDOWN ? texts.map((t) => ({ textContent: t })) : [],
  };
}

// Selector-aware: scanMounted queries bubbles and answers off the same
// container, so returning one list for every selector mixes them up.
function makeContainer(bubbles: FakeEl[], answers: FakeAnswer[]) {
  return {
    querySelectorAll: (sel: string) => {
      if (sel === SELECTORS.USER_MESSAGE_BUBBLE) return bubbles;
      if (sel === SELECTORS.CLAUDE_RESPONSE) return answers;
      return [];
    },
    querySelector: () => null,
  };
}

function makeArticle(setsize: number): FakeArticle {
  return { getAttribute: (k) => (k === 'aria-setsize' ? String(setsize) : null) };
}

// `setsize` is the turn count of the conversation these bubbles belong to —
// stamped onto each bubble's '[role="article"]' ancestor, which is where the
// tracker reads it. `foreignSetsize` fakes an unrelated article elsewhere in
// the document (the stale-nav frame during an SPA swap); the tracker must
// never consult it.
function makeDocument(
  bubbles: FakeEl[],
  setsize?: number,
  answers: FakeAnswer[] = [],
  foreignSetsize?: number,
) {
  for (const b of bubbles) b.article = setsize === undefined ? null : makeArticle(setsize);
  return {
    querySelector: (sel: string) => {
      if (sel === SELECTORS.CHAT_CONTAINER) return makeContainer(bubbles, answers);
      if (foreignSetsize !== undefined && sel === `${SELECTORS.TURN_ARTICLE}[aria-setsize]`) {
        return makeArticle(foreignSetsize);
      }
      return null;
    },
  };
}

// --- fixtures ---

const node0: ChatboxNode = {
  id: 'chatbox-0', index: 0, text: 'Hello',
  hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null,
};
const node1: ChatboxNode = {
  id: 'chatbox-1', index: 1, text: 'World',
  hasBranch: true, branchCurrent: 2, branchTotal: 2, parentId: null,
};
const node2: ChatboxNode = {
  id: 'chatbox-2', index: 2, text: 'After',
  hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null,
};
const baseNodes = [node0, node1, node2];

// --- tests ---

describe('mergeMountedNodes', () => {
  beforeEach(() => resetNodeCache());

  it('accumulates turns across scans of different virtualization windows', () => {
    // Window 1: turns 0 and 2 mounted
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q1', 0, 100),
      makeBubble(null, 'q2', 2, 500),
    ]);
    mergeMountedNodes();

    // Window 2 (scrolled down): turns 0/2 unmounted, 4/6 mounted
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q3', 4, 900),
      makeBubble(null, 'q4', 6, 1300),
    ]);
    const nodes = mergeMountedNodes();

    // Full conversation retained — ids from absolute position, index sequential
    expect(nodes.map((n) => n.id)).toEqual([
      'chatbox-0', 'chatbox-2', 'chatbox-4', 'chatbox-6',
    ]);
    expect(nodes.map((n) => n.index)).toEqual([0, 1, 2, 3]);
    expect(nodes.map((n) => n.text)).toEqual(['q1', 'q2', 'q3', 'q4']);
  });

  it('drops cached turns after a divergence (branch switch / edit)', () => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q1', 0),
      makeBubble(null, 'q2', 2),
      makeBubble(null, 'q3', 4),
    ]);
    mergeMountedNodes();

    // Turn 2's text changed (edited/branch-switched); turn 4 no longer mounted
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q1', 0),
      makeBubble(null, 'q2-edited', 2),
    ]);
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-2']);
    expect(nodes[1].text).toBe('q2-edited');
  });

  it('caches the turn scroll offset for unmounted-node navigation', () => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q1', 0, 100),
      makeBubble(null, 'q2', 2, 500),
    ]);
    mergeMountedNodes();

    expect(getCachedTop('chatbox-2')).toBe(500);
    expect(getCachedTop('chatbox-99')).toBeNull();
  });

  it('falls back to DOM order when virtualization ancestors are absent', () => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q1'),
      makeBubble(null, 'q2'),
    ]);
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-1']);
  });
});

describe('getCachedNodes', () => {
  beforeEach(() => resetNodeCache());

  it('returns the seeded cache without touching the DOM', () => {
    seedNodeCache([
      { id: 'chatbox-2', index: 0, text: 'b', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
      { id: 'chatbox-0', index: 1, text: 'a', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
    ]);
    // The previous conversation's DOM must never be queried on this path
    // (SPA transition, see observer.ts domTrusted).
    const query = jest.fn(() => null);
    (global as Record<string, unknown>).document = {
      querySelector: query,
      querySelectorAll: query,
    };

    const nodes = getCachedNodes();

    expect(query).not.toHaveBeenCalled();
    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-2']);
    expect(nodes.map((n) => n.index)).toEqual([0, 1]);
  });
});

describe('mergeMountedNodes — setsize pruning (SPA cross-session contamination)', () => {
  beforeEach(() => resetNodeCache());

  it('prunes cached turns at indices the conversation cannot contain', () => {
    // A scan spanning an SPA transition caught the previous conversation's
    // tail (high absolute indices) — no setsize exposed during the glitch.
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'prev-tail-1', 20),
      makeBubble(null, 'prev-tail-2', 22),
    ]);
    mergeMountedNodes();

    // The real (short) conversation mounts: 4 turns total, user turn at 0.
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'real-q1', 0)],
      4,
    );
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0']);
  });

  it('keeps cached turns within the conversation turn count', () => {
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0), makeBubble(null, 'q2', 2)],
      8,
    );
    mergeMountedNodes();

    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q4', 6)],
      8,
    );
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-2', 'chatbox-6']);
  });

  it('does not prune when aria-setsize is absent', () => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'tail', 20),
    ]);
    mergeMountedNodes();

    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q1', 0),
    ]);
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-20']);
  });

  it('ignores a non-positive aria-setsize (ARIA "unknown size" is -1)', () => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'tail', 20),
    ]);
    mergeMountedNodes();

    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0)],
      -1,
    );
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-20']);
  });

  it('also drops seeded (hydrated) turns beyond the turn count', () => {
    seedNodeCache([
      { id: 'chatbox-2', index: 0, text: 'kept', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
      { id: 'chatbox-30', index: 1, text: 'foreign', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
    ]);

    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0)],
      6,
    );
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-2']);
  });

  it('never prunes against an article the mounted bubbles do not belong to (stale-nav frame)', () => {
    // Hydrated long conversation; during an SPA swap the previous (short)
    // conversation's frame is still in the document and exposes its own,
    // smaller setsize.
    seedNodeCache([
      { id: 'chatbox-0', index: 0, text: 'q1', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
      { id: 'chatbox-40', index: 1, text: 'tail', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
    ]);

    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0)],
      undefined,
      [],
      4,
    );
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-40']);
  });

  it('does not prune when nothing is mounted', () => {
    seedNodeCache([
      { id: 'chatbox-40', index: 0, text: 'tail', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
    ]);

    (global as Record<string, unknown>).document = makeDocument([], undefined, [], 4);
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-40']);
  });
});

describe('mergeMountedNodes — unreadable turn state is not divergence', () => {
  beforeEach(() => resetNodeCache());

  const ids = (nodes: ChatboxNode[]) => nodes.map((n) => n.id);

  function scanThree(branchAt2?: string) {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q1', 0),
      makeBubble(null, 'q2', 2, undefined, { branch: branchAt2 }),
      makeBubble(null, 'q3', 4),
    ]);
    return mergeMountedNodes();
  }

  it('keeps the cached text and tail when a turn reads empty (edit mode / mid-render)', () => {
    scanThree();

    (global as Record<string, unknown>).document = makeDocument([makeBubble(null, '', 2)]);
    const nodes = mergeMountedNodes();

    expect(ids(nodes)).toEqual(['chatbox-0', 'chatbox-2', 'chatbox-4']);
    expect(nodes[1].text).toBe('q2');
  });

  it('does not diverge when a turn first read empty and then readable', () => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, '', 0),
      makeBubble(null, 'q2', 2),
    ]);
    mergeMountedNodes();

    (global as Record<string, unknown>).document = makeDocument([makeBubble(null, 'q1', 0)]);
    const nodes = mergeMountedNodes();

    expect(ids(nodes)).toEqual(['chatbox-0', 'chatbox-2']);
    expect(nodes[0].text).toBe('q1');
  });

  it('keeps the cached branch state and tail when the indicator is missing (hover-only actions bar)', () => {
    scanThree('2 / 3');

    // Same turn remounts without its actions wrapper → detectBranch reads 1 / 1.
    (global as Record<string, unknown>).document = makeDocument([makeBubble(null, 'q2', 2)]);
    const nodes = mergeMountedNodes();

    expect(ids(nodes)).toEqual(['chatbox-0', 'chatbox-2', 'chatbox-4']);
    expect(nodes[1]).toMatchObject({ hasBranch: true, branchCurrent: 2, branchTotal: 3 });
  });

  it('still drops the tail on a real branch switch', () => {
    scanThree('2 / 3');

    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q2', 2, undefined, { branch: '3 / 3' }),
    ]);
    const nodes = mergeMountedNodes();

    expect(ids(nodes)).toEqual(['chatbox-0', 'chatbox-2']);
    expect(nodes[1]).toMatchObject({ branchCurrent: 3, branchTotal: 3 });
  });

  it('still drops the tail when an edit creates the first branch (1 / 1 → 2 / 2)', () => {
    scanThree();

    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q2-edited', 2, undefined, { branch: '2 / 2' }),
    ]);
    const nodes = mergeMountedNodes();

    expect(ids(nodes)).toEqual(['chatbox-0', 'chatbox-2']);
    expect(nodes[1]).toMatchObject({ text: 'q2-edited', branchCurrent: 2, branchTotal: 2 });
  });
});

describe('mergeMountedNodes — stale-nav frame (issue #176)', () => {
  beforeEach(() => resetNodeCache());

  it('skips bubbles and answers inside an inert frame', () => {
    const stale = makeBubble(null, 'prev-conversation', 0, undefined, { inert: true });
    const live = makeBubble(null, 'q1', 2);
    (global as Record<string, unknown>).document = makeDocument(
      [stale, live],
      undefined,
      [makeAnswer(['prev-answer'], false, true), makeAnswer(['a1'])],
    );
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-2']);
    // Answer pairing is by index — the foreign answer must not shift it.
    expect(getCachedAnswer('chatbox-2')).toBe('a1');
    // Not tagged either: a stale bubble must never become a scroll target.
    expect(stale.getAttribute('data-nav-id')).toBeNull();
    expect(live.getAttribute('data-nav-id')).toBe('chatbox-2');
  });
});

// The observer's post-navigation trust signals (observer.ts domTrusted).
describe('post-navigation DOM trust', () => {
  beforeEach(() => resetNodeCache());

  // Added node fake: an element that is / contains a user bubble, optionally
  // inside the inert stale frame. `nodeType: 3` fakes a text node.
  function addedEl(opts: { bubble?: boolean; inert?: boolean; nodeType?: number } = {}) {
    return {
      nodeType: opts.nodeType ?? 1,
      matches: (sel: string) => sel === SELECTORS.USER_MESSAGE_BUBBLE && opts.bubble === true,
      querySelector: () => null,
      closest: (sel: string) => (sel === SELECTORS.INERT_FRAME && opts.inert ? {} : null),
    };
  }
  function record(...added: unknown[]): MutationRecord {
    return { addedNodes: added } as unknown as MutationRecord;
  }

  describe('mutationsMountTurn', () => {
    it('is true when a live user bubble is added', () => {
      expect(mutationsMountTurn([record(addedEl(), addedEl({ bubble: true }))])).toBe(true);
    });

    it('is true when an added subtree contains a user bubble', () => {
      const wrapper = { ...addedEl(), querySelector: (sel: string) => (sel === SELECTORS.USER_MESSAGE_BUBBLE ? {} : null) };
      expect(mutationsMountTurn([record(wrapper)])).toBe(true);
    });

    it('is false for unrelated elements and text nodes', () => {
      expect(mutationsMountTurn([record(addedEl(), addedEl({ nodeType: 3 }))])).toBe(false);
      expect(mutationsMountTurn([record()])).toBe(false);
    });

    it('ignores a bubble mounted inside the inert stale frame', () => {
      expect(mutationsMountTurn([record(addedEl({ bubble: true, inert: true }))])).toBe(false);
    });
  });

  describe('mountedDomMatchesCache', () => {
    function stored(id: string, text: string): ChatboxNode {
      return { id, index: 0, text, hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null };
    }

    it('is vacuously true with an empty cache', () => {
      (global as Record<string, unknown>).document = makeDocument([makeBubble(null, 'anything', 0)]);
      expect(mountedDomMatchesCache()).toBe(true);
    });

    it('is vacuously true when nothing is mounted', () => {
      seedNodeCache([stored('chatbox-0', 'q1')]);
      (global as Record<string, unknown>).document = makeDocument([]);
      expect(mountedDomMatchesCache()).toBe(true);
    });

    it('is true when mounted turns match the hydrated cache', () => {
      seedNodeCache([stored('chatbox-0', 'q1'), stored('chatbox-2', 'q2')]);
      (global as Record<string, unknown>).document = makeDocument([makeBubble(null, 'q2', 2)]);
      expect(mountedDomMatchesCache()).toBe(true);
    });

    it('is false when a mounted turn contradicts the hydrated cache (previous conversation still mounted)', () => {
      seedNodeCache([stored('chatbox-0', 'q1'), stored('chatbox-2', 'q2')]);
      (global as Record<string, unknown>).document = makeDocument([makeBubble(null, 'foreign', 2)]);
      expect(mountedDomMatchesCache()).toBe(false);
    });

    it('treats an empty text read as inconclusive', () => {
      seedNodeCache([stored('chatbox-2', 'q2')]);
      (global as Record<string, unknown>).document = makeDocument([makeBubble(null, '', 2)]);
      expect(mountedDomMatchesCache()).toBe(true);
    });

    it('does not modify the cache', () => {
      seedNodeCache([stored('chatbox-0', 'q1')]);
      (global as Record<string, unknown>).document = makeDocument([makeBubble(null, 'foreign', 0)]);
      mountedDomMatchesCache();
      expect(getCachedNodes().map((n) => n.text)).toEqual(['q1']);
    });
  });
});

describe('seedNodeCache (issue #152 hydration)', () => {
  beforeEach(() => resetNodeCache());

  function storedNode(id: string, text: string): ChatboxNode {
    return { id, index: 0, text, hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null };
  }

  it('restores stored nodes into the merged tree', () => {
    seedNodeCache([storedNode('chatbox-0', 'q1'), storedNode('chatbox-2', 'q2')]);

    // Only turn 4 is mounted (fresh window shows the conversation tail)
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'q3', 4, 900),
    ]);
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-2', 'chatbox-4']);
    expect(nodes.map((n) => n.index)).toEqual([0, 1, 2]);
  });

  it('never overwrites DOM-scanned entries', () => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'fresh-from-dom', 0, 100),
    ]);
    mergeMountedNodes();

    seedNodeCache([storedNode('chatbox-0', 'stale-from-storage')]);
    const nodes = mergeMountedNodes();

    expect(nodes[0].text).toBe('fresh-from-dom');
  });

  it('seeded nodes have no cached top (scroll falls back to estimate)', () => {
    seedNodeCache([storedNode('chatbox-2', 'q')]);
    expect(getCachedTop('chatbox-2')).toBeNull();
  });

  it('ignores nodes with malformed ids', () => {
    seedNodeCache([storedNode('bogus-id', 'q')]);
    (global as Record<string, unknown>).document = makeDocument([]);
    expect(mergeMountedNodes()).toEqual([]);
  });

  it('stale seeded turns are dropped once the DOM diverges at the same index', () => {
    seedNodeCache([
      storedNode('chatbox-0', 'q1'),
      storedNode('chatbox-2', 'old-branch'),
      storedNode('chatbox-4', 'old-tail'),
    ]);

    // DOM shows a different text at turn 2 → cached turns after 2 are stale
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble(null, 'new-branch', 2),
    ]);
    const nodes = mergeMountedNodes();

    expect(nodes.map((n) => n.id)).toEqual(['chatbox-0', 'chatbox-2']);
    expect(nodes[1].text).toBe('new-branch');
  });
});

describe('detectBranch', () => {
  // A bubble whose parent holds the "Message actions" wrapper. `indicator`
  // is the BRANCH_INDICATOR element's text; `wrapperText` the wrapper's own
  // textContent (what is left to read when the indicator class chain drifts).
  function bubbleWith(wrapper: { indicator?: string; wrapperText?: string } | null): HTMLElement {
    const wrapperEl =
      wrapper === null
        ? null
        : {
            textContent: wrapper.wrapperText ?? '',
            querySelector: (sel: string) =>
              sel === SELECTORS.BRANCH_INDICATOR && wrapper.indicator !== undefined
                ? { textContent: wrapper.indicator }
                : null,
          };
    return {
      parentElement: {
        querySelector: (sel: string) => (sel === SELECTORS.BRANCH_ACTIONS_WRAPPER ? wrapperEl : null),
      },
    } as unknown as HTMLElement;
  }

  it('reports no branch when the actions wrapper is absent', () => {
    expect(detectBranch(bubbleWith(null))).toEqual({ hasBranch: false, current: 1, total: 1 });
  });

  it('parses the indicator element', () => {
    expect(detectBranch(bubbleWith({ indicator: '2 / 3' }))).toEqual({ hasBranch: true, current: 2, total: 3 });
  });

  it('falls back to the wrapper text when the indicator class chain no longer matches', () => {
    expect(detectBranch(bubbleWith({ wrapperText: 'Edit Copy ‹ 2 / 3 ›' }))).toEqual({
      hasBranch: true, current: 2, total: 3,
    });
  });

  it('reads a single branch when the wrapper carries no "N / M"', () => {
    expect(detectBranch(bubbleWith({ wrapperText: 'Edit Copy' }))).toEqual({ hasBranch: true, current: 1, total: 1 });
  });
});

describe('absIndexFromNavId', () => {
  it('parses the absolute index', () => {
    expect(absIndexFromNavId('chatbox-12')).toBe(12);
  });

  it('returns null for malformed ids', () => {
    expect(absIndexFromNavId('nope')).toBeNull();
  });
});

describe('assignChatboxIds', () => {
  it('reassigns ids from DOM order even when stale duplicate ids exist', () => {
    // Reproduces the virtualization bug: remounted bubbles carried stale ids
    // (chatbox-4 and chatbox-5 duplicated, chatbox-0 missing).
    const bubbles = [
      makeBubble('chatbox-1', 'a'),
      makeBubble('chatbox-4', 'b'),
      makeBubble('chatbox-4', 'c'),
      makeBubble('chatbox-5', 'd'),
      makeBubble('chatbox-5', 'e'),
    ];
    (global as Record<string, unknown>).document = makeDocument(bubbles);

    const nodes = assignChatboxIds();

    expect(nodes.map((n) => n.id)).toEqual([
      'chatbox-0', 'chatbox-1', 'chatbox-2', 'chatbox-3', 'chatbox-4',
    ]);
    // DOM attributes rewritten too — scroll targets stay unique
    expect(bubbles.map((el) => el.getAttribute('data-nav-id'))).toEqual([
      'chatbox-0', 'chatbox-1', 'chatbox-2', 'chatbox-3', 'chatbox-4',
    ]);
  });
});

describe('reloadFromNode', () => {
  beforeEach(() => {
    (global as Record<string, unknown>).document = makeDocument([
      makeBubble('chatbox-0', 'Hello'),
      makeBubble('chatbox-1', 'World-switched'),
      makeBubble('chatbox-2', 'New content after switch'),
    ]);
  });

  it('falls back to full assignChatboxIds when branchNodeId is not found', () => {
    const result = reloadFromNode('chatbox-99', baseNodes);
    // full rescan returns all 3 DOM bubbles
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('chatbox-0');
    expect(result[2].id).toBe('chatbox-2');
  });

  it('preserves nodes up to and including the branch point', () => {
    const result = reloadFromNode('chatbox-1', baseNodes);
    expect(result[0]).toBe(node0); // same reference — not re-scanned
    expect(result[1]).toBe(node1); // branch point itself preserved
  });

  it('re-scans DOM nodes after the branch point', () => {
    const result = reloadFromNode('chatbox-1', baseNodes);
    expect(result).toHaveLength(3);
    expect(result[2].id).toBe('chatbox-2');
    expect(result[2].text).toBe('New content after switch');
  });

  it('sets parentId to null on re-scanned nodes (buildTree will reassign)', () => {
    const result = reloadFromNode('chatbox-1', baseNodes);
    expect(result[2].parentId).toBeNull();
  });

  it('returns only preserved nodes when branch point is the last element', () => {
    const result = reloadFromNode('chatbox-2', baseNodes);
    expect(result).toHaveLength(3);
    // all three preserved — nothing after index 2
    expect(result[0]).toBe(node0);
    expect(result[1]).toBe(node1);
    expect(result[2]).toBe(node2);
  });

  it('returns preserved slice when container is absent', () => {
    (global as Record<string, unknown>).document = {
      querySelector: () => null,
    };
    const result = reloadFromNode('chatbox-1', baseNodes);
    // container missing → return preserved only
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(node0);
    expect(result[1]).toBe(node1);
  });
});

// Answers feed the summary pipeline (#160): read at scan time, never persisted
// on the node itself. Pairing is by mounted DOM order — bubble i ↔ answer i.
describe('answer reading (summary pipeline #160)', () => {
  beforeEach(() => resetNodeCache());

  it('pairs each mounted answer to the bubble at the same index', () => {
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0), makeBubble(null, 'q2', 2)],
      undefined,
      [makeAnswer(['a1']), makeAnswer(['a2'])],
    );
    mergeMountedNodes();

    expect(getCachedAnswer('chatbox-0')).toBe('a1');
    expect(getCachedAnswer('chatbox-2')).toBe('a2');
  });

  it('joins several markdown blocks in one turn', () => {
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0)],
      undefined,
      [makeAnswer(['para one', 'para two'])],
    );
    mergeMountedNodes();

    expect(getCachedAnswer('chatbox-0')).toBe('para one\n\npara two');
  });

  it('does not read a still-streaming answer', () => {
    // A generating turn exposes partial text — reading it would cache a
    // summary of half an answer.
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0)],
      undefined,
      [makeAnswer(['half of an ans'], true)],
    );
    mergeMountedNodes();

    expect(getCachedAnswer('chatbox-0')).toBeNull();
  });

  it('keeps the answer after the turn is virtualized out', () => {
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0)],
      undefined,
      [makeAnswer(['a1'])],
    );
    mergeMountedNodes();

    // Scrolled away: turn 0 unmounted, turn 2 mounted with its own answer.
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q2', 2)],
      undefined,
      [makeAnswer(['a2'])],
    );
    mergeMountedNodes();

    expect(getCachedAnswer('chatbox-0')).toBe('a1');
    expect(getCachedAnswer('chatbox-2')).toBe('a2');
  });

  it('returns null for a turn with no answer element yet', () => {
    // Newest user message, assistant has not started responding.
    (global as Record<string, unknown>).document = makeDocument(
      [makeBubble(null, 'q1', 0), makeBubble(null, 'q2', 2)],
      undefined,
      [makeAnswer(['a1'])],
    );
    mergeMountedNodes();

    expect(getCachedAnswer('chatbox-2')).toBeNull();
  });
});
