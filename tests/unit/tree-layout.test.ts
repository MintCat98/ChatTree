// Unit tests for the collapsed-run layout (issue #167).
//
// Verifies:
//   1. hidden nodes leave the row flow; visible rows keep NODE_STEP spacing
//   2. consecutive hidden nodes merge into ONE run; a visible node splits runs
//   3. runs group by display order, so sortOrder 'desc' regroups them
//   4. "+ n" pill y: middle / leading / trailing / all-hidden, and top clamping

import { buildTreeLayout, runCenterY } from '@content/panel/components/tree-layout';
import { NODE_STEP, RUN_PILL_HEIGHT, nodeCenterY } from '@content/panel/components/constants';
import { DEFAULT_NODE_METADATA, type ChatboxNode, type NodeMetadata } from '@shared/types';

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

// Builds metadata marking the given indices hidden.
function hide(...indices: number[]): Record<string, NodeMetadata> {
  const meta: Record<string, NodeMetadata> = {};
  for (const i of indices) {
    meta[`chatbox-${i}`] = { ...DEFAULT_NODE_METADATA, hidden: true };
  }
  return meta;
}

const NODES = [node(0), node(1), node(2), node(3), node(4)];
const ids = (ns: ChatboxNode[]) => ns.map((n) => n.id);

// ---------------------------------------------------------------------------
// buildTreeLayout
// ---------------------------------------------------------------------------

describe('buildTreeLayout', () => {
  it('returns every node and no runs when nothing is hidden', () => {
    const { visible, runs } = buildTreeLayout(NODES, {});

    expect(ids(visible)).toEqual(ids(NODES));
    expect(runs).toEqual([]);
  });

  it('treats a node with no metadata entry as visible', () => {
    const { visible } = buildTreeLayout(NODES, {
      'chatbox-1': { ...DEFAULT_NODE_METADATA, bookmarked: true, tags: ['a'] },
    });

    expect(visible).toHaveLength(5);
  });

  it('drops a hidden node from the rows and records it as a run', () => {
    const { visible, runs } = buildTreeLayout(NODES, hide(2));

    expect(ids(visible)).toEqual(['chatbox-0', 'chatbox-1', 'chatbox-3', 'chatbox-4']);
    expect(runs).toEqual([{ nodeIds: ['chatbox-2'], beforeVisibleIndex: 2 }]);
  });

  it('merges consecutive hidden nodes into a single run', () => {
    const { visible, runs } = buildTreeLayout(NODES, hide(1, 2, 3));

    expect(ids(visible)).toEqual(['chatbox-0', 'chatbox-4']);
    expect(runs).toEqual([
      { nodeIds: ['chatbox-1', 'chatbox-2', 'chatbox-3'], beforeVisibleIndex: 1 },
    ]);
  });

  it('splits into two runs when a visible node separates them', () => {
    const { visible, runs } = buildTreeLayout(NODES, hide(1, 3));

    expect(ids(visible)).toEqual(['chatbox-0', 'chatbox-2', 'chatbox-4']);
    expect(runs).toEqual([
      { nodeIds: ['chatbox-1'], beforeVisibleIndex: 1 },
      { nodeIds: ['chatbox-3'], beforeVisibleIndex: 2 },
    ]);
  });

  it('records a leading run with beforeVisibleIndex 0', () => {
    const { visible, runs } = buildTreeLayout(NODES, hide(0, 1));

    expect(ids(visible)).toEqual(['chatbox-2', 'chatbox-3', 'chatbox-4']);
    expect(runs).toEqual([
      { nodeIds: ['chatbox-0', 'chatbox-1'], beforeVisibleIndex: 0 },
    ]);
  });

  it('records a trailing run with beforeVisibleIndex === visible.length', () => {
    const { visible, runs } = buildTreeLayout(NODES, hide(3, 4));

    expect(visible).toHaveLength(3);
    expect(runs).toEqual([
      { nodeIds: ['chatbox-3', 'chatbox-4'], beforeVisibleIndex: 3 },
    ]);
  });

  it('collapses everything into one run when all nodes are hidden', () => {
    const { visible, runs } = buildTreeLayout(NODES, hide(0, 1, 2, 3, 4));

    expect(visible).toEqual([]);
    expect(runs).toHaveLength(1);
    expect(runs[0].nodeIds).toHaveLength(5);
    expect(runs[0].beforeVisibleIndex).toBe(0);
  });

  it('groups by display order, so a descending list regroups the runs', () => {
    // Ascending: 1 and 3 hidden → two separate runs. Reversed the neighbours
    // change, but 1 and 3 are still separated by the visible node 2.
    const desc = [...NODES].reverse();
    const { visible, runs } = buildTreeLayout(desc, hide(1, 3));

    expect(ids(visible)).toEqual(['chatbox-4', 'chatbox-2', 'chatbox-0']);
    expect(runs).toEqual([
      { nodeIds: ['chatbox-3'], beforeVisibleIndex: 1 },
      { nodeIds: ['chatbox-1'], beforeVisibleIndex: 2 },
    ]);
  });

  it('keeps the two ends as separate runs after the descending sort', () => {
    // 0 and 4 are the two ends ascending; reversed, 4 is first and 0 is last,
    // so they stay separate runs — a leading and a trailing one.
    const desc = [...NODES].reverse();
    const { runs } = buildTreeLayout(desc, hide(0, 4));

    expect(runs).toEqual([
      { nodeIds: ['chatbox-4'], beforeVisibleIndex: 0 },
      { nodeIds: ['chatbox-0'], beforeVisibleIndex: 3 },
    ]);
  });

  it('handles an empty node list', () => {
    expect(buildTreeLayout([], hide(0))).toEqual({ visible: [], runs: [] });
  });
});

// ---------------------------------------------------------------------------
// runCenterY
// ---------------------------------------------------------------------------

describe('runCenterY', () => {
  it('puts a middle run at the midpoint between the two surrounding rows', () => {
    const run = { nodeIds: ['chatbox-2'], beforeVisibleIndex: 2 };

    const y = runCenterY(run, 4, 0);

    expect(y).toBe((nodeCenterY(1) + nodeCenterY(2)) / 2);
    expect(y).toBe(nodeCenterY(1) + NODE_STEP / 2);
  });

  it('puts a trailing run half a step below the last row', () => {
    const run = { nodeIds: ['chatbox-4'], beforeVisibleIndex: 3 };

    expect(runCenterY(run, 3, 0)).toBe(nodeCenterY(2) + NODE_STEP / 2);
  });

  it('clamps a leading run so it is not clipped off the top of the SVG', () => {
    const run = { nodeIds: ['chatbox-0'], beforeVisibleIndex: 0 };
    const unclamped = nodeCenterY(0) - NODE_STEP / 2;

    const y = runCenterY(run, 4, 0);

    expect(unclamped).toBeLessThan(RUN_PILL_HEIGHT / 2);
    expect(y).toBe(RUN_PILL_HEIGHT / 2 + 2);
  });

  it('places a leading run in the gap below the ghost row when one exists', () => {
    const run = { nodeIds: ['chatbox-0'], beforeVisibleIndex: 0 };

    const y = runCenterY(run, 4, 1);

    expect(y).toBe(nodeCenterY(1) - NODE_STEP / 2);
    expect(y).toBe((nodeCenterY(0) + nodeCenterY(1)) / 2);
  });

  it('shifts middle runs down by the ghost row', () => {
    const run = { nodeIds: ['chatbox-2'], beforeVisibleIndex: 2 };

    expect(runCenterY(run, 4, 1)).toBe(nodeCenterY(2) + NODE_STEP / 2);
  });

  it('centers the pill on the single row when every node is hidden', () => {
    const run = { nodeIds: ['chatbox-0', 'chatbox-1'], beforeVisibleIndex: 0 };

    expect(runCenterY(run, 0, 0)).toBe(nodeCenterY(0));
    expect(runCenterY(run, 0, 1)).toBe(nodeCenterY(1));
  });
});
