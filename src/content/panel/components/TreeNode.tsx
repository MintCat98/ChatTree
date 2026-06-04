// One tree row: [row highlight] + numbered circle + question label (+ branch badge).
// Visual differentiation (Claude Chat Navigation Figma):
//   - latest (newest) node  → clay-filled circle, white number, soft glow
//   - active (in viewport)  → clay ring
//   - previous nodes        → outlined gray circle, muted number
// Full prompt text is also available on hover via <Tooltip>.

import { useCallback, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react';
import type { ChatboxNode } from '@shared/types';
import { scrollToNode } from '../../scroll-navigator';
import { usePanelStore } from '../store/panel-store';
import { NODE_RADIUS, NODE_RADIUS_ACTIVE, NODE_STEP, NODE_LABEL_FONT_SIZE, ROW_V_GAP, truncate } from './constants';
import { NodeBadge } from './NodeBadge';

interface TreeNodeProps {
  node: ChatboxNode;
  cx: number;
  cy: number;
  isLatest: boolean;
  labelX: number;
  labelMaxChars: number;
  rowX: number;
  rowWidth: number;
}

export function TreeNode({
  node,
  cx,
  cy,
  isLatest,
  labelX,
  labelMaxChars,
  rowX,
  rowWidth,
}: TreeNodeProps) {
  const activeNodeId = usePanelStore((s) => s.activeNodeId);
  const hoveredNodeId = usePanelStore((s) => s.hoveredNodeId);
  const setHoveredNode = usePanelStore((s) => s.setHoveredNode);
  const setHoverPos = usePanelStore((s) => s.setHoverPos);

  const isActive = activeNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const isBranch = node.hasBranch;
  const filled = isLatest; // primary clay highlight = newest question
  const ring = isActive && !isLatest; // "you are here" indicator

  const r = filled || isActive ? NODE_RADIUS_ACTIVE : isHovered ? NODE_RADIUS + 1 : NODE_RADIUS;

  const circleFill = filled ? 'var(--nav-color-node-active)' : 'var(--nav-color-node-fill)';
  const circleStroke = filled
    ? 'transparent'
    : ring || isHovered
      ? 'var(--nav-color-accent)'
      : 'var(--nav-color-node-border)';
  const circleStrokeW = filled ? 0 : ring ? 2 : 1.5;
  const numberFill = filled
    ? 'var(--nav-color-node-active-text)'
    : ring
      ? 'var(--nav-color-accent)'
      : 'var(--nav-color-node-number)';

  const rowFill = isLatest
    ? 'var(--nav-color-accent-soft)'
    : isHovered
      ? 'var(--nav-color-surface-2)'
      : 'transparent';

  const labelFill = isLatest ? 'var(--nav-color-text)' : 'var(--nav-color-text-secondary)';

  const circleStyle: CSSProperties = {
    transition: 'r var(--nav-duration-fast) ease',
    filter: filled ? 'var(--nav-active-glow)' : 'none',
  };

  const handleClick = useCallback(
    (e: MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      scrollToNode(node.id);
    },
    [node.id],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        scrollToNode(node.id);
      }
    },
    [node.id],
  );

  const handleMouseEnter = useCallback(
    (e: MouseEvent<SVGGElement>) => {
      setHoveredNode(node.id);
      setHoverPos({ x: e.clientX, y: e.clientY });
    },
    [node.id, setHoveredNode, setHoverPos],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGGElement>) => setHoverPos({ x: e.clientX, y: e.clientY }),
    [setHoverPos],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setHoverPos(null);
  }, [setHoveredNode, setHoverPos]);

  const rowH = NODE_STEP - ROW_V_GAP;

  return (
    <g
      role="treeitem"
      aria-label={node.text}
      aria-selected={isActive}
      aria-current={isLatest ? 'true' : undefined}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'pointer', outline: 'none' }}
      data-nav-id={node.id}
    >
      {/* Row highlight */}
      <rect
        x={rowX}
        y={cy - rowH / 2}
        width={rowWidth}
        height={rowH}
        rx={10}
        ry={10}
        fill={rowFill}
        style={{ transition: 'fill var(--nav-duration-fast) ease' }}
      />

      {/* Node circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={circleFill}
        stroke={circleStroke}
        strokeWidth={circleStrokeW}
        style={circleStyle}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={numberFill}
        fontFamily="var(--nav-font-family)"
        style={{ fontSize: 'var(--nav-font-size-sm)' }}
        fontWeight={700}
        pointerEvents="none"
      >
        {node.index + 1}
      </text>

      {/* Question label */}
      <text
        x={labelX}
        y={cy}
        textAnchor="start"
        dominantBaseline="central"
        fill={labelFill}
        fontFamily="var(--nav-font-family)"
        style={{ fontSize: NODE_LABEL_FONT_SIZE }}
        fontWeight={isLatest ? 600 : 450}
        pointerEvents="none"
      >
        {truncate(node.text, labelMaxChars)}
      </text>

      {isBranch ? (
        <NodeBadge
          cx={cx + NODE_RADIUS}
          cy={cy - NODE_RADIUS}
          current={node.branchCurrent}
          total={node.branchTotal}
        />
      ) : null}
    </g>
  );
}
