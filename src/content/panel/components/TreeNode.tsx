// Individual tree node — circle + inline text + (when applicable) NodeBadge.
// Click sends SCROLL_TO_NODE message; hover updates hoveredNodeId; keyboard
// Enter/Space mirror click behavior for accessibility.

import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import type { ChatboxNode } from '@shared/types';
import { scrollToNode } from '../../scroll-navigator';
import { usePanelStore } from '../store/panel-store';
import {
  NODE_RADIUS,
  NODE_RADIUS_ACTIVE,
  truncate,
} from './constants';
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

  const handleMouseEnter = useCallback(() => {
    setHoveredNode(node.id);
  }, [node.id, setHoveredNode]);

  const handleMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, [setHoveredNode]);

  return (
    <g
      role="treeitem"
      aria-label={node.text}
      aria-selected={isActive}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
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
        fill="var(--nav-color-text)"
        fontSize="var(--nav-font-size-sm)"
        fontFamily="var(--nav-font-family)"
        pointerEvents="none"
      >
        {truncate(node.text)}
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
