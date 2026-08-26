// SVG tree container.
// Left rail of numbered circles + connector line, with the question label to the
// right of each node (Claude Chat Navigation Figma layout). Width follows the
// user-adjustable panel width (issue 02).

import { usePanelStore } from '../store/panel-store';
import { useMessages } from '../i18n';
import {
  NODE_RADIUS,
  NODE_STEP,
  COLUMN_X,
  LABEL_GAP,
  ROW_INSET,
  calcSvgHeight,
  nodeCenterY,
  PANEL_PADDING,
} from './constants';
import { buildTreeLayout, runCenterY } from './tree-layout';
import { TreeNode } from './TreeNode';
import { NodeConnector } from './NodeConnector';
import { GhostNode } from './GhostNode';
import { EmptyState } from './EmptyState';
import { TagEditorPopover } from './TagEditorPopover';
import { CollapsedRunButton } from './CollapsedRunButton';
import { setNodeMetadataBatch } from '@shared/metadata-storage';
import { absIndexFromNavId } from '../../chatbox-tracker';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export function TreeMapCanvas() {
  const t = useMessages();
  const tree = usePanelStore((s) => s.tree);
  const width = usePanelStore((s) => s.settings.panelWidth);
  const bookmarksOnlyFilter = usePanelStore((s) => s.bookmarksOnlyFilter);
  const activeTagFilters = usePanelStore((s) => s.activeTagFilters);
  const searchQuery = usePanelStore((s) => s.searchQuery);
  const tagEditNodeId   = usePanelStore((s) => s.tagEditNodeId);
  const sessionMetadata = usePanelStore((s) => s.sessionMetadata);
  const patchNodeMetadata = usePanelStore((s) => s.patchNodeMetadata);
  const sessionId       = usePanelStore((s) => s.tree?.sessionId ?? '');
  const sortOrder = usePanelStore((s) => s.settings.sortOrder);
  const maxVisibleNodes = usePanelStore((s) => s.settings.maxVisibleNodes);
  const activeNodeId = usePanelStore((s) => s.activeNodeId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ghost row when the conversation has turns before the first scanned one
  // (issue #152): ids encode absolute turn position, so a minimum above 0
  // means earlier messages were never mounted/scanned into the tree.
  const minAbsIndex =
    tree?.nodes.reduce((min, n) => {
      const abs = absIndexFromNavId(n.id);
      return abs !== null && abs < min ? abs : min;
    }, Infinity) ?? Infinity;
  const hasEarlierMessages = Number.isFinite(minAbsIndex) && minAbsIndex > 0;
  // Ascending order puts the ghost at row 0, shifting every node down one row.
  const ghostOffset = hasEarlierMessages && sortOrder === 'asc' ? 1 : 0;

  // Sorting and the hidden-node split both feed the auto-scroll effect below,
  // so they have to be derived before it — hooks cannot sit after the
  // EmptyState early return.
  const sortedNodes = useMemo(
    () => (sortOrder === 'asc' ? tree?.nodes ?? [] : [...(tree?.nodes ?? [])].reverse()),
    [tree, sortOrder],
  );
  const { visible, runs } = useMemo(
    () => buildTreeLayout(sortedNodes, sessionMetadata),
    [sortedNodes, sessionMetadata],
  );

  useEffect(() => {
    if(!activeNodeId || !scrollRef.current || !tree) return;

    // Indexed against the rendered rows, not tree.nodes: hidden nodes are not
    // rows at all (-1 → no scroll), and rows follow the sort order.
    const activeIndex = visible.findIndex((n) => n.id === activeNodeId);
    if (activeIndex === -1) return;

    const nodeY = nodeCenterY(activeIndex + ghostOffset);
    const container = scrollRef.current;
    const containerHeight = container.clientHeight;

    // scroll only if node is out of current view
    if (nodeY < container.scrollTop || nodeY > container.scrollTop + containerHeight){
      if(nodeY < container.scrollTop) { // scrolls above visible range
        container.scrollTo({
          top: nodeY - PANEL_PADDING,
          behavior: 'smooth',
        });
      } else if  (nodeY > container.scrollTop + containerHeight) { // scrolls below viisble range
        container.scrollTo({
          top: nodeY - containerHeight + PANEL_PADDING,
          behavior: 'smooth',
        });
      }
    }
  }, [activeNodeId, tree, visible, ghostOffset]);

  // Expanding is a permanent unhide: the metadata flag is the single source of
  // truth, so the conversation DOM (#168) can subscribe to it without drifting.
  // One batched storage write — N parallel setNodeMetadata calls would each
  // read the store before the others wrote and lose all but the last patch.
  const expandRun = useCallback(
    (nodeIds: string[]) => {
      nodeIds.forEach((id) => patchNodeMetadata(id, { hidden: false }));
      setNodeMetadataBatch(sessionId, nodeIds, { hidden: false });
    },
    [sessionId, patchNodeMetadata],
  );

  if (!tree || tree.nodes.length === 0) {
    return <EmptyState />;
  }

  // Every node hidden is not the same as an empty tree — keep one row so the
  // "+ n" pill has somewhere to live.
  const totalRows = Math.max(visible.length + (hasEarlierMessages ? 1 : 0), 1);
  const height = calcSvgHeight(totalRows);
  // Ghost row sits adjacent to the oldest node: top in asc, bottom in desc.
  const ghostRow = sortOrder === 'asc' ? 0 : visible.length;

  const labelX = COLUMN_X + NODE_RADIUS + LABEL_GAP;
  const rowWidth = width - ROW_INSET * 2;
  const maxIndex = sortedNodes.reduce((m, n) => Math.max(m, n.index), 0);

  // Looked up in `visible` so hiding a node closes its open tag editor instead
  // of leaving the popover anchored to a row that is no longer rendered.
  const tagEditNode = tagEditNodeId
    ? visible.find((n) => n.id === tagEditNodeId) ?? null
    : null;

  const treemapClass = [
    'nav-treemap',
    bookmarksOnlyFilter         ? 'is-filtered'        : '',
    activeTagFilters.length > 0 ? 'is-tag-filtered'    : '',
    searchQuery.trim()          ? 'is-search-filtered' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
    ref={scrollRef}
      data-testid="treemap-canvas"
      className={treemapClass}
      style={{
        maxHeight: maxVisibleNodes * NODE_STEP,
        overflowY: 'auto',
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="tree"
        aria-label={t.treeAria}
      >
        {/* 1) Connectors first so nodes render on top of them. */}
        {visible.slice(0, -1).map((node, i) => (
          <NodeConnector
            key={`conn-${node.id}`}
            x={COLUMN_X}
            yFrom={nodeCenterY(i + ghostOffset)}
            yTo={nodeCenterY(i + 1 + ghostOffset)}
          />
        ))}

        {/* Dashed connector between the ghost row and the oldest node. */}
        {hasEarlierMessages && visible.length > 0 && (
          <line
            x1={COLUMN_X}
            y1={nodeCenterY(ghostRow === 0 ? 0 : visible.length - 1) + NODE_RADIUS}
            x2={COLUMN_X}
            y2={nodeCenterY(ghostRow === 0 ? 1 : ghostRow) - NODE_RADIUS}
            stroke="var(--nav-color-edge)"
            strokeWidth={2}
            strokeDasharray="3 4"
            strokeLinecap="round"
          />
        )}

        {/* 2) Nodes (circle + number + label) on top. */}
        {visible.map((node, i) => (
          <TreeNode
            key={node.id}
            node={node}
            cx={COLUMN_X}
            cy={nodeCenterY(i + ghostOffset)}
            labelX={labelX}
            rowX={ROW_INSET}
            rowWidth={rowWidth}
          />
        ))}

        {hasEarlierMessages && (
          <GhostNode
            cx={COLUMN_X}
            cy={nodeCenterY(ghostRow)}
            labelX={labelX}
            rowX={ROW_INSET}
            rowWidth={rowWidth}
          />
        )}

        {/* 3) Collapsed runs last so the pill paints over the connector line. */}
        {runs.map((run) => (
          <CollapsedRunButton
            key={`run-${run.nodeIds[0]}`}
            cx={COLUMN_X}
            cy={runCenterY(run, visible.length, ghostOffset)}
            count={run.nodeIds.length}
            onExpand={() => expandRun(run.nodeIds)}
          />
        ))}
      </svg>

      {tagEditNode && (
        <TagEditorPopover
          nodeIndex={visible.indexOf(tagEditNode) + ghostOffset}
          nodeId={tagEditNode.id}
          sessionId={sessionId}
          currentTags={sessionMetadata[tagEditNode.id]?.tags ?? []}
        />
      )}
    </div>
  );
}
