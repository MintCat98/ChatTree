// Ghost row shown when the conversation has earlier messages that were never
// scanned into the tree (issue #152) — a truncated tree must look truncated.
// Clicking jumps the conversation to the top so claude.ai mounts the earliest
// turns and the observer scans them in.

import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { useMessages } from '../i18n';
import { scrollToConversationTop } from '../../scroll-navigator';
import { NODE_RADIUS, NODE_STEP, ROW_V_GAP, LABEL_TRAILING_MARGIN } from './constants';

interface GhostNodeProps {
  cx: number;
  cy: number;
  labelX: number;
  rowX: number;
  rowWidth: number;
}

export function GhostNode({ cx, cy, labelX, rowX, rowWidth }: GhostNodeProps) {
  const t = useMessages();

  const labelWidth = rowWidth - labelX + rowX - LABEL_TRAILING_MARGIN;
  const rowH = NODE_STEP - ROW_V_GAP;

  const handleClick = useCallback((e: MouseEvent<SVGGElement>) => {
    e.stopPropagation();
    scrollToConversationTop();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToConversationTop();
    }
  }, []);

  return (
    <g
      role="treeitem"
      aria-label={t.earlierMessagesAria}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="nav-node nav-ghost-node"
      style={{ cursor: 'pointer' }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={NODE_RADIUS}
        fill="none"
        stroke="var(--nav-color-edge)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--nav-font-family)"
        fill="var(--nav-color-text-secondary)"
        pointerEvents="none"
      >
        ⋯
      </text>
      <foreignObject x={labelX} y={cy - rowH / 2} width={labelWidth} height={rowH}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            // Smaller than regular rows + up to 2 lines — the hint must stay
            // fully readable at narrow panel widths (row height fits 2 lines).
            fontSize: 'var(--nav-font-size-sm)',
            fontFamily: 'var(--nav-font-family)',
            fontStyle: 'italic',
            color: 'var(--nav-color-text-secondary)',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              flex: '1 1 0',
              minWidth: 0,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.35,
            }}
          >
            {t.earlierMessagesHint}
          </span>
        </div>
      </foreignObject>
    </g>
  );
}
