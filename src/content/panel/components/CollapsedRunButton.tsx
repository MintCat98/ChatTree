// "+ n" pill marking a run of hidden nodes collapsed into the spine (issue #167).
// Anchored to the GAP between rows, never to a node — the mirror of the node's
// hide control. Unlike the hover-only affordances this is always visible: it IS
// the collapsed-state indicator. Clicking expands the run for good (clears the
// `hidden` flag), so the panel and the conversation DOM (#168) never disagree.

import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { useMessages } from '../i18n';
import { RUN_PILL_HEIGHT, RUN_PILL_MIN_WIDTH, RUN_PILL_WIDE_WIDTH } from './constants';

interface CollapsedRunButtonProps {
  cx: number;    // Spine x — same column as the node circles.
  cy: number;    // Gap midpoint, from runCenterY().
  count: number; // Hidden nodes in this run.
  onExpand: () => void;
}

export function CollapsedRunButton({ cx, cy, count, onExpand }: CollapsedRunButtonProps) {
  const t = useMessages();
  const width = count >= 10 ? RUN_PILL_WIDE_WIDTH : RUN_PILL_MIN_WIDTH;

  const handleClick = useCallback(
    (e: MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      onExpand();
    },
    [onExpand],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onExpand();
      }
    },
    [onExpand],
  );

  return (
    <g
      role="button"
      aria-label={t.expandHidden(count)}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="nav-collapsed-run"
    >
      <rect
        x={cx - width / 2}
        y={cy - RUN_PILL_HEIGHT / 2}
        width={width}
        height={RUN_PILL_HEIGHT}
        rx={RUN_PILL_HEIGHT / 2}
        ry={RUN_PILL_HEIGHT / 2}
        // Background-colored stroke punches the connector line out from behind
        // the pill, the same trick NodeBadge uses.
        stroke="var(--nav-color-bg)"
        strokeWidth={2}
        className="nav-collapsed-run-pill"
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--nav-font-family)"
        fontSize="var(--nav-font-size-xs)"
        fontWeight={600}
        pointerEvents="none"
        className="nav-collapsed-run-count"
      >
        +{count}
      </text>
    </g>
  );
}
