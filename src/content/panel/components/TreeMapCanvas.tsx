// SVG tree container.
// Distributes coordinates to child components based on node index.
// Renders EmptyState when store.tree is null or contains no nodes.

import { usePanelStore } from '../store/panel-store';
import {
  PANEL_WIDTH,
  NODE_STEP,
  LANE_OFFSET,
  calcSvgHeight,
  nodeCenterY,
} from './constants';
import { TreeNode } from './TreeNode';
import { NodeConnector } from './NodeConnector';
import { BranchLane } from './BranchLane';
import { EmptyState } from './EmptyState';

export function TreeMapCanvas() {
  const tree = usePanelStore((s) => s.tree);

  if (!tree || tree.nodes.length === 0) {
    return <EmptyState />;
  }

  const { nodes } = tree;
  const height = calcSvgHeight(nodes.length);
  const centerX = PANEL_WIDTH / 2;

  return (
    <div
      data-testid="treemap-canvas"
      style={{
        width: '100%',
        maxHeight: '50vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <svg
        width={PANEL_WIDTH}
        height={height}
        viewBox={`0 0 ${PANEL_WIDTH} ${height}`}
        role="tree"
        aria-label="Chat node tree"
      >
        {/* 1) Connectors first so nodes render on top of them. */}
        {nodes.slice(0, -1).map((node, i) => (
          <NodeConnector
            key={`conn-${node.id}`}
            x={centerX}
            yFrom={nodeCenterY(i)}
            yTo={nodeCenterY(i + 1)}
          />
        ))}

        {/* 2) Branch lanes at branch-point nodes. */}
        {nodes.map((node, i) =>
          node.hasBranch ? (
            <BranchLane
              key={`lane-${node.id}`}
              startX={centerX}
              startY={nodeCenterY(i)}
              endX={centerX + LANE_OFFSET}
              endY={nodeCenterY(i) + NODE_STEP * 0.6}
            />
          ) : null,
        )}

        {/* 3) Nodes on top so they cover the connectors. */}
        {nodes.map((node, i) => (
          <TreeNode
            key={node.id}
            node={node}
            cx={centerX}
            cy={nodeCenterY(i)}
          />
        ))}
      </svg>
    </div>
  );
}
