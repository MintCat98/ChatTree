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

  if (!tree || tree.nodes.length === 0) {
    return <EmptyState />;
  }

  const { nodes } = tree;
  const height = calcSvgHeight(nodes.length);

  const labelX = COLUMN_X + NODE_RADIUS + LABEL_GAP;
  const rowWidth = width - ROW_INSET * 2;
  //const maxIndex = nodes.reduce((m, n) => Math.max(m, n.index), 0);

  return (
    <div
      data-testid="treemap-canvas"
      className="nav-treemap"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="tree"
        aria-label="Chat node tree"
      >
        {/* 1) Connectors first so nodes render on top of them. */}
        {nodes.slice(0, -1).map((node, i) => (
          <NodeConnector
            key={`conn-${node.id}`}
            x={COLUMN_X}
            yFrom={nodeCenterY(i)}
            yTo={nodeCenterY(i + 1)}
          />
        ))}

        {/* 2) Branch lanes at branch-point nodes. */}
        {/*
        {nodes.map((node, i) =>
          node.hasBranch ? (
            <BranchLane
              key={`lane-${node.id}`}
              startX={COLUMN_X}
              startY={nodeCenterY(i)}
              endX={COLUMN_X + LANE_OFFSET}
              endY={nodeCenterY(i) + NODE_STEP * 0.6}
            />
          ) : null,
        )}
          */}

        {/* 3) Nodes (circle + number + label) on top. */}
        {nodes.map((node, i) => (
          <TreeNode
            key={node.id}
            node={node}
            cx={COLUMN_X}
            cy={nodeCenterY(i)}
            labelX={labelX}
            rowX={ROW_INSET}
            rowWidth={rowWidth}
          />
        ))}
      </svg>
    </div>
  );
}
