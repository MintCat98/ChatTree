// Coordinate constants for the SVG tree map.
// Changing these values automatically propagates to every component.

export const NODE_RADIUS = 13;         // Default node radius (26px diameter, matches Figma).
export const NODE_RADIUS_ACTIVE = 14;  // Latest/active node radius (28px diameter).
export const NODE_STEP = 58;           // Vertical distance between adjacent nodes.
export const PANEL_PADDING = 22;       // Top/bottom padding inside the SVG.
export const LANE_OFFSET = 20;         // Horizontal offset of the branch lane from the main lane.
export const PANEL_WIDTH = 280;        // Default panel width (overridden by settings.panelWidth).
export const LABEL_MAX_CHARS = 25;     // Max characters displayed inside a node before truncation.
export const TOOLTIP_DELAY_MS = 300;   // Delay before showing the tooltip on hover.

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
