// SVG tree container.
// Left rail of numbered circles + connector line, with the question label to the
// right of each node (Claude Chat Navigation Figma layout). Width follows the
// user-adjustable panel width (issue 02).

import { usePanelStore } from '../store/panel-store';
import {
  NODE_RADIUS,
  NODE_STEP,
  LANE_OFFSET,
  COLUMN_X,
  LABEL_GAP,
  ROW_INSET,
  AVG_CHAR_PX_AT_12,
  LABEL_TRAILING_MARGIN,
  calcSvgHeight,
  nodeCenterY,
} from './constants';
import { TreeNode } from './TreeNode';
import { NodeConnector } from './NodeConnector';
import { BranchLane } from './BranchLane';
import { EmptyState } from './EmptyState';

export function TreeMapCanvas() {
  const tree = usePanelStore((s) => s.tree);
  const width = usePanelStore((s) => s.settings.panelWidth);
  const sortOrder = usePanelStore((s) => s.settings.sortOrder);
  const maxVisibleNodes = usePanelStore((s) => s.settings.maxVisibleNodes);

  if (!tree || tree.nodes.length === 0) {
    return <EmptyState />;
  }

  const sortedNodes = sortOrder === 'asc' ? [...tree.nodes] : [...tree.nodes].reverse();
  const height = calcSvgHeight(sortedNodes.length);

  const labelX = COLUMN_X + NODE_RADIUS + LABEL_GAP;
  const labelMaxChars = Math.max(6, Math.floor((width - labelX - LABEL_TRAILING_MARGIN) / AVG_CHAR_PX_AT_12));
  const rowWidth = width - ROW_INSET * 2;
  const maxIndex = sortedNodes.reduce((m, n) => Math.max(m, n.index), 0);

  return (
    <div data-testid="treemap-canvas" className="nav-treemap"
      style={{
        maxHeight: calcSvgHeight(maxVisibleNodes),
        overflowY: 'auto',
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="tree"
        aria-label="Chat node tree"
      >
        {/* 1) Connectors first so nodes render on top of them. */}
        {sortedNodes.slice(0, -1).map((node, i) => (
          <NodeConnector
            key={`conn-${node.id}`}
            x={COLUMN_X}
            yFrom={nodeCenterY(i)}
            yTo={nodeCenterY(i + 1)}
          />
        ))}

        {/* 2) Branch lanes at branch-point nodes. */}
        {sortedNodes.map((node, i) =>
          node.hasBranch ? (
            <BranchLane
              key={`lane-${node.id}`}
              startX={COLUMN_X}
              startY={nodeCenterY(i)}
              endX={COLUMN_X + LANE_OFFSET}
              endY={nodeCenterY(i) + NODE_STEP * 0.6}
            />
          ) : null
        )}

        {/* 3) Nodes (circle + number + label) on top. */}
        {sortedNodes.map((node, i) => (
          <TreeNode
            key={node.id}
            node={node}
            cx={COLUMN_X}
            cy={nodeCenterY(i)}
            isLatest={node.index === maxIndex}
            labelX={labelX}
            labelMaxChars={labelMaxChars}
            rowX={ROW_INSET}
            rowWidth={rowWidth}
          />
        ))}
      </svg>
    </div>
  );
}
