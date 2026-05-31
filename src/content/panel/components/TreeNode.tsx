// Individual tree node — circle + inline text + (when applicable) NodeBadge.
// Click sends SCROLL_TO_NODE message; hover updates hoveredNodeId; keyboard
// Enter/Space mirror click behavior for accessibility.

import { useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { MessageType } from '@shared/message-types';
import type { ChatboxNode } from '@shared/types';
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
  const setHoveredNode = usePanelStore((s) => s.setHoveredNode);

  const isActive = activeNodeId === node.id;
  const isBranchPoint = node.hasBranch;
  const r = isActive ? NODE_RADIUS_ACTIVE : NODE_RADIUS;

  const fillVar = isActive
    ? 'var(--nav-color-node-active)'
    : isBranchPoint
      ? 'var(--nav-color-node-branch)'
      : 'var(--nav-color-node)';

  const handleClick = useCallback(
    (e: MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: MessageType.SCROLL_TO_NODE,
        payload: { navId: node.id },
      });
    },
    [node.id],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        chrome.runtime.sendMessage({
          type: MessageType.SCROLL_TO_NODE,
          payload: { navId: node.id },
        });
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
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fillVar}
        stroke={isActive ? 'var(--nav-color-text)' : 'transparent'}
        strokeWidth={isActive ? 2 : 0}
        style={{
          transition: 'all var(--nav-duration-fast)',
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
