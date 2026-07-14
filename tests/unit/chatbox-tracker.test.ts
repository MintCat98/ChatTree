// Unit tests for reloadFromNode — partial tree reload after a branch switch.

import {
  assignChatboxIds,
  mergeMountedNodes,
  resetNodeCache,
  seedNodeCache,
  getCachedTop,
  absIndexFromNavId,
  reloadFromNode,
} from '@content/chatbox-tracker';
import type { ChatboxNode } from '@shared/types';
import { SELECTORS } from '@shared/constants';

// --- minimal DOM fakes ---

type FakeEl = {
  getAttribute: (k: string) => string | null;
  setAttribute: (k: string, v: string) => void;
  querySelector: (sel: string) => { textContent: string } | null;
  closest: (sel: string) => unknown;
  parentElement: null;
};

// Bubble without virtualization ancestors — getAbsolutePosition falls back to
// DOM order. Pass absIndex/top to fake the '[data-index]' wrapper.
function makeBubble(
  navId: string | null,
  text: string,
  absIndex?: number,
  top?: number,
): FakeEl {
  const attrs: Record<string, string> = navId ? { 'data-nav-id': navId } : {};
  const wrapper =
    absIndex === undefined
      ? null
      : {
          getAttribute: (k: string) => (k === 'data-index' ? String(absIndex) : null),
          style: { top: top === undefined ? '' : `${top}px` },
        };
  return {
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: (k, v) => { attrs[k] = v; },
    querySelector: (sel) =>
      sel === '[data-testid="user-message"]' ? { textContent: text } : null,
    closest: (sel) => (sel === '[data-index]' ? wrapper : null),
    parentElement: null, // detectBranch sees no wrapper → hasBranch: false
  };
}

function makeContainer(bubbles: FakeEl[]) {
  return {
    querySelectorAll: (_sel: string) => bubbles,
    querySelector: (_sel: string) => null,
  };
}

function makeDocument(bubbles: FakeEl[]) {
  return {
    querySelector: (sel: string) =>
      sel === SELECTORS.CHAT_CONTAINER ? makeContainer(bubbles) : null,
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
