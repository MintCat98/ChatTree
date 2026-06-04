// Coordinate constants for the SVG tree map.
// Changing these values automatically propagates to every component.

export const NODE_RADIUS = 13;         // Default node radius (26px diameter, matches Figma).
export const NODE_RADIUS_ACTIVE = 14;  // Latest/active node radius (28px diameter).
export const NODE_STEP = 58;           // Vertical distance between adjacent nodes.
export const PANEL_PADDING = 22;       // Top/bottom padding inside the SVG.
export const LANE_OFFSET = 20;         // Horizontal offset of the branch lane from the main lane.
export const LABEL_MAX_CHARS = 25;     // Max characters displayed inside a node before truncation.
export const TOOLTIP_DELAY_MS = 300;   // Delay before showing the tooltip on hover.

// SVG layout coordinates (shared by TreeMapCanvas and TreeNode).
export const COLUMN_X = 32;              // x of the node circle centers (left rail).
export const LABEL_GAP = 12;             // Gap between circle edge and label.
export const ROW_INSET = 10;             // Left/right inset of the row hover background.
export const ROW_V_GAP = 10;             // Vertical gap trimmed from NODE_STEP for the row rect height.
export const NODE_LABEL_FONT_SIZE = 12;  // Font size (px) for the question label text.

// Label width estimation (TreeMapCanvas).
export const AVG_CHAR_PX_AT_12 = 6.6;    // Approximate px per char at 12px font size.
export const LABEL_TRAILING_MARGIN = 16;  // Right-side padding subtracted from the label area.

/**
 * Compute the SVG viewBox height for the given node count.
 * Layout = top/bottom padding + N nodes × step.
 */
export function calcSvgHeight(nodeCount: number): number {
  if (nodeCount === 0) return 0;
  return PANEL_PADDING * 2 + nodeCount * NODE_STEP;
}

/**
 * Map a node index (0-based) to its vertical center coordinate.
 */
export function nodeCenterY(index: number): number {
  return PANEL_PADDING + index * NODE_STEP + NODE_RADIUS;
}

/**
 * Truncate text for SVG <text> rendering.
 * CSS `text-overflow: ellipsis` does not apply to SVG, so we slice manually.
 */
export function truncate(text: string, max = LABEL_MAX_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}
