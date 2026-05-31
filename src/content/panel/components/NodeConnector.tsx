// Vertical line between two adjacent nodes.
// Endpoints are pulled back by NODE_RADIUS so the line stops at the node edge,
// not at the node center.

import { NODE_RADIUS } from './constants';

interface NodeConnectorProps {
  x: number;
  yFrom: number;  // Upper node center y.
  yTo: number;    // Lower node center y.
}

export function NodeConnector({ x, yFrom, yTo }: NodeConnectorProps) {
  return (
    <line
      x1={x}
      y1={yFrom + NODE_RADIUS}
      x2={x}
      y2={yTo - NODE_RADIUS}
      stroke="var(--nav-color-edge)"
      strokeWidth={2}
    />
  );
}
