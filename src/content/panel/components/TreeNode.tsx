// One tree row: [row highlight] + numbered circle + question label (+ branch badge).
// Visual differentiation (Claude Chat Navigation Figma):
//   - latest (newest) node  → clay-filled circle, white number, soft glow
//   - active (in viewport)  → clay ring
//   - previous nodes        → outlined gray circle, muted number
// Full prompt text is also available on hover via <Tooltip>.

import { useCallback, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import type { ChatboxNode } from '@shared/types';
import { scrollToNode } from '../../scroll-navigator';
import { usePanelStore } from '../store/panel-store';
import { NODE_RADIUS, NODE_RADIUS_ACTIVE, NODE_STEP, ROW_V_GAP, truncate } from './constants';
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
  const filled = isLatest;

  const r = filled || isActive ? NODE_RADIUS_ACTIVE : isHovered ? NODE_RADIUS + 1 : NODE_RADIUS;

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

  const rafRef = useRef<number | null>(null);
  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGGElement>) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const { clientX: x, clientY: y } = e;
      rafRef.current = requestAnimationFrame(() => {
        setHoverPos({ x, y });
        rafRef.current = null;
      });
    },
    [setHoverPos],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setHoverPos(null);
  }, [setHoveredNode, setHoverPos]);

  const rowH = NODE_STEP - ROW_V_GAP;

  const nodeClass = [
    'nav-node',
    isLatest ? 'is-latest' : '',
    isActive && !isLatest ? 'is-active' : '',
    isHovered ? 'is-hovered' : '',
    isBranch ? 'is-branch' : '',
  ]
    .filter(Boolean)
    .join(' ');

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
      className={nodeClass}
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
        className="nav-node-row"
      />

      {/* Node circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className="nav-node-circle"
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--nav-font-family)"
        fontWeight={700}
        pointerEvents="none"
        className="nav-node-number"
      >
        {node.index + 1}
      </text>

      {/* Question label */}
      <text
        x={labelX}
        y={cy}
        textAnchor="start"
        dominantBaseline="central"
        fontFamily="var(--nav-font-family)"
        pointerEvents="none"
        className="nav-node-label"
      >
        {truncate(node.text, labelMaxChars)}
      </text>

      {isBranch && node.branchTotal > 1 ? ( // Check if there are two or more branches
        <NodeBadge
          cx={cx}
          cy={cy - NODE_RADIUS}
          current={node.branchCurrent}
          total={node.branchTotal}
        />
      ) : null}
    </g>
  );
}
