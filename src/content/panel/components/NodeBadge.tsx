// Branch-point badge rendered at the top-right of a branch-point node.
// Format: "🔀 total·current". Click is isolated from the parent node click
// so a click on the badge does not also fire SCROLL_TO_NODE.

import type { MouseEvent } from 'react';

interface NodeBadgeProps {
  cx: number;       // Anchor x (node's right edge).
  cy: number;       // Anchor y (node's top edge).
  current: number;  // 1-based current branch index.
  total: number;    // Total branch count at this point.
}

const BADGE_WIDTH = 56;
const BADGE_HEIGHT = 18;

export function NodeBadge({ cx, cy, current, total }: NodeBadgeProps) {
  const handleClick = (e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    // TODO: open the branch mini-menu in a follow-up component PR.
  };

  return (
    <g
      role="status"
      aria-label={`Branch ${current} of ${total}`}
      onClick={handleClick}
      style={{ cursor: 'default' }}
    >
      <rect
        x={cx - 4}
        y={cy - BADGE_HEIGHT / 2}
        width={BADGE_WIDTH}
        height={BADGE_HEIGHT}
        rx={9}
        ry={9}
        fill="var(--nav-color-node-branch)"
        stroke="var(--nav-color-bg)"
        strokeWidth={2}
      />
      <text
        x={cx - 4 + BADGE_WIDTH / 2}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--nav-color-text)"
        fontSize="10"
        fontFamily="var(--nav-font-family)"
        pointerEvents="none"
      >
        🔀 {total}·{current}
      </text>
    </g>
  );
}
