// Unit tests for reloadFromNode — partial tree reload after a branch switch.

import { reloadFromNode } from '@content/chatbox-tracker';
import type { ChatboxNode } from '@shared/types';

// --- minimal DOM fakes ---

type FakeEl = {
  getAttribute: (k: string) => string | null;
  setAttribute: (k: string, v: string) => void;
  querySelector: (sel: string) => { textContent: string } | null;
  parentElement: null;
};

function makeBubble(navId: string, text: string): FakeEl {
  const attrs: Record<string, string> = { 'data-nav-id': navId };
  return {
    getAttribute: (k) => attrs[k] ?? null,
    setAttribute: (k, v) => { attrs[k] = v; },
    querySelector: (sel) =>
      sel === '[data-testid="user-message"]' ? { textContent: text } : null,
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
      sel === '#main-content' ? makeContainer(bubbles) : null,
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
