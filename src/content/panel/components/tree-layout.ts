// Collapsed-run layout for hidden nodes (issue #167).
// Hidden nodes are dropped from the row flow entirely — the remaining rows keep
// their normal NODE_STEP spacing — and each consecutive run of hidden nodes is
// represented by a single "+ n" pill sitting on the spine, in the gap between
// the two surrounding visible rows.
//
// Kept as a plain .ts module (not inside a component) so the math is unit
// testable: Jest's testMatch only picks up tests/unit/**/*.test.ts.

import type { ChatboxNode, NodeMetadata } from '@shared/types';
import { NODE_STEP, RUN_PILL_HEIGHT, nodeCenterY } from './constants';

export interface CollapsedRun {
  // Hidden node IDs, in display order. Expanding the run clears `hidden` on all of them.
  nodeIds: string[];
  // Index into `visible` of the row BELOW the run; equals visible.length for a
  // trailing run and 0 for a leading one.
  beforeVisibleIndex: number;
}

export interface TreeLayout {
  visible: ChatboxNode[];
  runs: CollapsedRun[];
}

/**
 * Split already-sorted nodes into the rows that get rendered and the collapsed
 * runs between them. Must be called AFTER sorting so runs group by what the
 * user actually sees (sortOrder 'desc' reverses adjacency).
 */
export function buildTreeLayout(
  sortedNodes: ChatboxNode[],
  metadata: Record<string, NodeMetadata>,
): TreeLayout {
  const visible: ChatboxNode[] = [];
  const runs: CollapsedRun[] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length === 0) return;
    runs.push({ nodeIds: current, beforeVisibleIndex: visible.length });
    current = [];
  };

  for (const node of sortedNodes) {
    if (metadata[node.id]?.hidden) {
      current.push(node.id);
    } else {
      flush();
      visible.push(node);
    }
  }
  flush(); // trailing run

  return { visible, runs };
}

/**
 * Vertical center of a run's "+ n" pill: the midpoint of the gap it occupies.
 * `ghostOffset` is the row shift applied by the "earlier messages" ghost row.
 */
export function runCenterY(
  run: CollapsedRun,
  visibleCount: number,
  ghostOffset: number,
): number {
  // Every node hidden — no gap to sit in, so the pill takes the single row.
  if (visibleCount === 0) return nodeCenterY(ghostOffset);

  if (run.beforeVisibleIndex === 0) {
    // Leading run: the gap above the first visible row. Without a ghost row
    // above it this lands in the SVG's top padding, so clamp it into view.
    const y = nodeCenterY(ghostOffset) - NODE_STEP / 2;
    return Math.max(y, RUN_PILL_HEIGHT / 2 + 2);
  }

  // Middle and trailing runs both hang below the last visible row above them.
  return nodeCenterY(run.beforeVisibleIndex - 1 + ghostOffset) + NODE_STEP / 2;
}
