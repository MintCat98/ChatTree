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
import { TreeNode } from './TreeNode';
import { NodeConnector } from './NodeConnector';
import { EmptyState } from './EmptyState';
import { TagEditorPopover } from './TagEditorPopover';

export function TreeMapCanvas() {
  const t = useMessages();
  const tree = usePanelStore((s) => s.tree);
  const width = usePanelStore((s) => s.settings.panelWidth);
  const bookmarksOnlyFilter = usePanelStore((s) => s.bookmarksOnlyFilter);
  const activeTagFilters = usePanelStore((s) => s.activeTagFilters);
  const searchQuery = usePanelStore((s) => s.searchQuery);
  const tagEditNodeId   = usePanelStore((s) => s.tagEditNodeId);
  const sessionMetadata = usePanelStore((s) => s.sessionMetadata);
  const sessionId       = usePanelStore((s) => s.tree?.sessionId ?? '');
  const sortOrder = usePanelStore((s) => s.settings.sortOrder);
  const maxVisibleNodes = usePanelStore((s) => s.settings.maxVisibleNodes);

  if (!tree || tree.nodes.length === 0) {
    return <EmptyState />;
  }

  const sortedNodes = sortOrder === 'asc' ? [...tree.nodes] : [...tree.nodes].reverse();
  const height = calcSvgHeight(sortedNodes.length);

  const labelX = COLUMN_X + NODE_RADIUS + LABEL_GAP;
  const rowWidth = width - ROW_INSET * 2;
  const maxIndex = sortedNodes.reduce((m, n) => Math.max(m, n.index), 0);

  const tagEditNode = tagEditNodeId
    ? sortedNodes.find((n) => n.id === tagEditNodeId) ?? null
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
        {sortedNodes.slice(0, -1).map((node, i) => (
          <NodeConnector
            key={`conn-${node.id}`}
            x={COLUMN_X}
            yFrom={nodeCenterY(i)}
            yTo={nodeCenterY(i + 1)}
          />
        ))}

        {/* 2) Nodes (circle + number + label) on top. */}
        {sortedNodes.map((node, i) => (
          <TreeNode
            key={node.id}
            node={node}
            cx={COLUMN_X}
            cy={nodeCenterY(i)}
            labelX={labelX}
            rowX={ROW_INSET}
            rowWidth={rowWidth}
          />
        ))}
      </svg>

      {tagEditNode && (
        <TagEditorPopover
          nodeIndex={sortedNodes.indexOf(tagEditNode)}
          nodeId={tagEditNode.id}
          sessionId={sessionId}
          currentTags={sessionMetadata[tagEditNode.id]?.tags ?? []}
        />
      )}
    </div>
  );
}
