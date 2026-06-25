// One tree row: [row highlight] + numbered circle + question label (+ branch badge).
// Visual differentiation (Claude Chat Navigation Figma):
//   - latest (newest) node  → clay-filled circle, white number, soft glow
//   - active (in viewport)  → clay ring
//   - previous nodes        → outlined gray circle, muted number
// Full prompt text is also available on hover via <Tooltip>.

import { useCallback, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import type { ChatboxNode } from '@shared/types';
import { setNodeMetadata } from '@shared/metadata-storage';
import { scrollToNode } from '../../scroll-navigator';
import { usePanelStore } from '../store/panel-store';
import { NODE_RADIUS, NODE_RADIUS_ACTIVE, NODE_STEP, ROW_V_GAP, LABEL_TRAILING_MARGIN, ROW_INSET, ICON_HALF } from './constants';
import { NodeBadge } from './NodeBadge';
import { BookmarkButton } from './BookmarkButton';
import { TagButton } from './TagButton';

interface TreeNodeProps {
  node: ChatboxNode;
  cx: number;
  cy: number;
  labelX: number;
  rowX: number;
  rowWidth: number;
}

export function TreeNode({
  node,
  cx,
  cy,
  labelX,
  rowX,
  rowWidth,
}: TreeNodeProps) {
  const activeNodeId = usePanelStore((s) => s.activeNodeId);
  const hoveredNodeId = usePanelStore((s) => s.hoveredNodeId);
  const setHoveredNode = usePanelStore((s) => s.setHoveredNode);
  const setHoverPos = usePanelStore((s) => s.setHoverPos);
  const sessionMetadata = usePanelStore((s) => s.sessionMetadata);
  const patchNodeMetadata = usePanelStore((s) => s.patchNodeMetadata);
  const sessionId = usePanelStore((s) => s.tree?.sessionId ?? '');
  const tagEditNodeId = usePanelStore((s) => s.tagEditNodeId);
  const setTagEditNodeId = usePanelStore((s) => s.setTagEditNodeId);
  const activeTagFilters = usePanelStore((s) => s.activeTagFilters);
  const searchQuery = usePanelStore((s) => s.searchQuery);

  const isActive = activeNodeId === node.id;
  const isHovered = hoveredNodeId === node.id;
  const isBranch = node.hasBranch;
  const isBookmarked = sessionMetadata[node.id]?.bookmarked ?? false;
  const nodeTags = sessionMetadata[node.id]?.tags ?? [];
  const hasTags = nodeTags.length > 0;
  const isTagOpen = tagEditNodeId === node.id;
  const isTagMatch =
    activeTagFilters.length === 0 || activeTagFilters.some((t) => nodeTags.includes(t));
  const sq = searchQuery.toLowerCase().trim();
  const isSearchMatch = !sq || node.text.toLowerCase().includes(sq);

  const r = isActive ? NODE_RADIUS_ACTIVE : isHovered ? NODE_RADIUS + 1 : NODE_RADIUS;

  const labelWidth = rowWidth - labelX + rowX - LABEL_TRAILING_MARGIN;
  const rowH = NODE_STEP - ROW_V_GAP;

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

  const handleBookmarkToggle = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const next = !isBookmarked;
      patchNodeMetadata(node.id, { bookmarked: next });
      setNodeMetadata(sessionId, node.id, { bookmarked: next });
    },
    [node.id, sessionId, isBookmarked, patchNodeMetadata],
  );

  const handleTagClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setTagEditNodeId(isTagOpen ? null : node.id);
    },
    [node.id, isTagOpen, setTagEditNodeId],
  );

  const nodeClass = [
    'nav-node',
    isActive? 'is-active' : '',
    isHovered ? 'is-hovered' : '',
    isBranch ? 'is-branch' : '',
    isBookmarked ? 'is-bookmarked' : '',
    isTagMatch ? 'is-tag-match' : '',
    isSearchMatch ? 'is-search-match' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <g
      role="treeitem"
      aria-label={node.text}
      aria-selected={isActive}
      aria-current={isActive ? 'true' : undefined}
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
      <foreignObject
        x={labelX}
        y={cy - rowH / 2}
        width={labelWidth}
        height={rowH}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'elliopsis',
            fontSize: '12px',
            fontFamily: 'var(--nav-font-family)',
            color: 'var(--nav-color-text-secondary)',
            pointerEvents: 'none',
          }}
        >
          {node.text}
        </div>
      </foreignObject>

      {isBranch && node.branchTotal > 1 ? ( // Check if there are two or more branches
        <NodeBadge
          cx={cx + NODE_RADIUS}
          cy={cy - 3 * NODE_RADIUS / 2}
          current={node.branchCurrent}
          total={node.branchTotal}
        />
      ) : null}

      {/* Left-side icon stack: bookmark (top) + tag (bottom), vertically centered on cy */}
      <BookmarkButton
        x={ROW_INSET}
        cy={cy - ICON_HALF}
        isBookmarked={isBookmarked}
        onToggle={handleBookmarkToggle}
      />
      <TagButton
        x={ROW_INSET}
        cy={cy + ICON_HALF}
        hasTags={hasTags}
        isOpen={isTagOpen}
        onClick={handleTagClick}
      />
    </g>
  );
}
