// Unit tests for the parent resolution used by the Interactive Map (issue #164).
//
// Covers three behaviours the reviewer flagged for coverage:
//   1. parentOverride precedence — override wins over chain parent
//   2. parentDisconnected      — explicit disconnect forces a root
//   3. cycle handling          — pickParent falls back to root instead of
//                                emitting a cycle that would strand nodes
//
// pickParent and wouldCreateCycle must be exported from InteractiveMap.tsx
// for these tests to reach them.

import { pickParent, wouldCreateCycle } from '@content/panel/components/parent-resolver';
import { DEFAULT_NODE_METADATA } from '@shared/types';
import type { ChatboxNode, NodeMetadata } from '@shared/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function node(i: number): ChatboxNode {
  return {
    id: `chatbox-${i}`,
    index: i,
    text: `q${i}`,
    hasBranch: false,
    branchCurrent: 1,
    branchTotal: 1,
    parentId: i === 0 ? null : `chatbox-${i - 1}`,
  };
}

// n0 → n1 → n2 → n3 chain (the shape used in the reviewer's repro).
const CHAIN = [node(0), node(1), node(2), node(3)];

// Convenience builder — merge partial metadata into defaults per-node.
function meta(
  entries: Record<string, Partial<NodeMetadata>>,
): Record<string, NodeMetadata> {
  const out: Record<string, NodeMetadata> = {};
  for (const [id, patch] of Object.entries(entries)) {
    out[id] = { ...DEFAULT_NODE_METADATA, ...patch };
  }
  return out;
}

// Silence the "Cycle detected" console.warn from pickParent's safety-net
// so the test output stays readable. Cycle tests below still assert the
// safety-net fires by checking the returned parent.
let warnSpy: jest.SpyInstance;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// pickParent — parentOverride precedence
// ---------------------------------------------------------------------------

describe('pickParent — parentOverride', () => {
  it('takes precedence over the chain parent when set', () => {
    // n2's chain parent is n1; override to n0 should win.
    const m = meta({ 'chatbox-2': { parentOverride: 'chatbox-0' } });

    expect(pickParent(CHAIN, 2, m)).toBe('chatbox-0');
  });

  it('falls back to the chain parent when override is null', () => {
    const m = meta({ 'chatbox-2': { parentOverride: null } });

    expect(pickParent(CHAIN, 2, m)).toBe('chatbox-1');
  });

  it('falls back to the chain parent when no metadata entry exists', () => {
    expect(pickParent(CHAIN, 2, {})).toBe('chatbox-1');
  });

  it('returns null for the first node regardless of override state', () => {
    // Overriding n0 to point at itself is nonsense; safety-net catches it,
    // and even without that, index 0 has no chain parent.
    expect(pickParent(CHAIN, 0, {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pickParent — parentDisconnected
// ---------------------------------------------------------------------------

describe('pickParent — parentDisconnected', () => {
  it('returns null so the node becomes a new root', () => {
    const m = meta({ 'chatbox-2': { parentDisconnected: true } });

    expect(pickParent(CHAIN, 2, m)).toBeNull();
  });

  it('takes precedence over parentOverride when both are set', () => {
    // Explicit disconnect is a stronger user signal than a stale override.
    const m = meta({
      'chatbox-2': { parentDisconnected: true, parentOverride: 'chatbox-0' },
    });

    expect(pickParent(CHAIN, 2, m)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// wouldCreateCycle — pure predicate used by both the snap loop and pickParent
// ---------------------------------------------------------------------------

describe('wouldCreateCycle', () => {
  it('flags a self-loop (A → A)', () => {
    expect(wouldCreateCycle('chatbox-1', 'chatbox-1', CHAIN, {})).toBe(true);
  });

  it('flags a cycle via the chain parent (repro: n1 → n2, n2 chain parent n1)', () => {
    // No override set anywhere. Walking up from n2's chain parent reaches n1.
    expect(wouldCreateCycle('chatbox-1', 'chatbox-2', CHAIN, {})).toBe(true);
  });

  it('flags a cycle that only appears through an override chain', () => {
    // n2's override points at n1, so making n1's parent = n2 would loop
    // n1 → n2 → n1 via the resolved chain.
    const m = meta({ 'chatbox-2': { parentOverride: 'chatbox-1' } });

    expect(wouldCreateCycle('chatbox-1', 'chatbox-2', CHAIN, m)).toBe(true);
  });

  it('returns false for a valid up-chain reparent', () => {
    // n2 → n0 skips n1 but does not close a loop.
    expect(wouldCreateCycle('chatbox-2', 'chatbox-0', CHAIN, {})).toBe(false);
  });

  it('handles a longer transitive cycle (A → B → C → A)', () => {
    // n1's override → n3; n3's chain parent → n2; n2's chain parent → n1.
    // Making n1's parent = n3 closes a 3-hop cycle.
    const m = meta({ 'chatbox-1': { parentOverride: 'chatbox-3' } });

    expect(wouldCreateCycle('chatbox-1', 'chatbox-3', CHAIN, m)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// pickParent — cycle safety-net for corrupt persisted state
// ---------------------------------------------------------------------------

describe('pickParent — cycle safety-net', () => {
  it('falls back to root when honoring the override would create a cycle', () => {
    // The exact state the reviewer's repro leaves in chrome.storage.local:
    // n1's override points at n2, but n2's chain parent is still n1.
    const m = meta({ 'chatbox-1': { parentOverride: 'chatbox-2' } });

    expect(pickParent(CHAIN, 1, m)).toBeNull();
  });

  it('warns when the safety-net fires so the fallback is discoverable', () => {
    const m = meta({ 'chatbox-1': { parentOverride: 'chatbox-2' } });

    pickParent(CHAIN, 1, m);

    expect(warnSpy).toHaveBeenCalled();
    const message = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('chatbox-1');
    expect(message).toContain('chatbox-2');
  });

  it('does not mutate the metadata object when falling back', () => {
    // The persisted override must survive so the user can reassign via UI.
    const m = meta({ 'chatbox-1': { parentOverride: 'chatbox-2' } });
    const snapshot = JSON.parse(JSON.stringify(m));

    pickParent(CHAIN, 1, m);

    expect(m).toEqual(snapshot);
  });

  it('still returns valid overrides when no cycle is present', () => {
    // Regression: the safety-net must not fire on well-formed state.
    const m = meta({ 'chatbox-2': { parentOverride: 'chatbox-0' } });

    expect(pickParent(CHAIN, 2, m)).toBe('chatbox-0');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});