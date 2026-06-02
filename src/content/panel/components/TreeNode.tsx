// Individual tree node — circle + order number + (when applicable) NodeBadge.
// The circle carries the 1-based order number so the map stays readable; the
// full prompt text is shown on hover via <Tooltip> (issue 01) and kept in
// aria-label for accessibility.
// Click sends SCROLL_TO_NODE; hover updates hoveredNodeId + cursor position;
// keyboard Enter/Space mirror click.

import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import type { ChatboxNode } from '@shared/types';
import { scrollToNode } from '../../scroll-navigator';
import { usePanelStore } from '../store/panel-store';
import { NODE_RADIUS, NODE_RADIUS_ACTIVE } from './constants';
import { NodeBadge } from './NodeBadge';

interface TreeNodeProps {
  node: ChatboxNode;
  cx: number;
  cy: number;
}

export function TreeNode({ node, cx, cy }: TreeNodeProps) {
  const activeNodeId = usePanelStore((s) => s.activeNodeId);
  const hoveredNodeId = usePanelStore((s) => s.hoveredNodeId);
  const setHoveredNode = usePanelStore((s) => s.setHoveredNode);
  const setHoverPos = usePanelStore((s) => s.setHoverPos);

  const isActive = activeNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const isBranchPoint = node.hasBranch;
  // Hover nudges the radius up a touch for a tactile feel; active is largest.
  const r = isActive ? NODE_RADIUS_ACTIVE : isHovered ? NODE_RADIUS + 1.5 : NODE_RADIUS;

  // Gradient fills give each node state a subtle vertical sheen (visual only —
  // the gradient ids are defined in TreeMapCanvas <defs>).
  const fillVar = isActive
    ? 'url(#nav-node-active-grad)'
    : isBranchPoint
      ? 'url(#nav-node-branch-grad)'
      : 'url(#nav-node-grad)';

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
    (e: MouseEvent<SVGGElement>) => {
      setHoverPos({ x: e.clientX, y: e.clientY });
    },
    [setHoverPos],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
    setHoverPos(null);
  }, [setHoveredNode, setHoverPos]);

  return (
    <g
      role="treeitem"
      aria-label={node.text}
      aria-selected={isActive}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'pointer', outline: 'none' }}
      data-nav-id={node.id}
    >
      {/* Pulsing halo ring around the node the user is currently viewing. */}
      {isActive ? (
        <circle
          cx={cx}
          cy={cy}
          r={r + 5}
          fill="none"
          stroke="var(--nav-color-node-active-ring)"
          strokeWidth={1.5}
          opacity={0.5}
          style={{ animation: 'nav-pulse 2s ease-in-out infinite' }}
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fillVar}
        stroke={isActive ? 'var(--nav-color-node-active-ring)' : 'rgba(255,255,255,0.18)'}
        strokeWidth={isActive ? 2 : 1}
        filter={isActive ? 'var(--nav-glow-active)' : undefined}
        style={{
          transition: 'r var(--nav-duration-fast) ease, filter var(--nav-duration-fast) ease',
        }}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#ffffff"
        fontSize="var(--nav-font-size-base)"
        fontFamily="var(--nav-font-family)"
        fontWeight={600}
        pointerEvents="none"
      >
        {node.index + 1}
      </text>
      {isBranchPoint ? (
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
