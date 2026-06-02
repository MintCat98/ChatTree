// Tooltip showing the full prompt text when a node is hovered (issue 01).
// Anchored to the cursor position (store.hoverPos) rather than the node element,
// because nodes live inside a closed Shadow DOM and can't be located via
// document.querySelector. Rendered through a Portal to document.body so it is not
// clipped by the panel; colors are literal (not --nav-* vars) since those tokens
// are scoped to the Shadow :host and don't apply at document.body.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelStore } from '../store/panel-store';

const TOOLTIP_DELAY_MS = 300;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_MAX_HEIGHT = 200;
const CURSOR_OFFSET = 16;

export function Tooltip() {
  const hoveredNodeId = usePanelStore((s) => s.hoveredNodeId);
  const hoverPos = usePanelStore((s) => s.hoverPos);
  const tree = usePanelStore((s) => s.tree);
  const [visible, setVisible] = useState(false);
  const delayTimerRef = useRef<number | null>(null);

  const node = hoveredNodeId
    ? (tree?.nodes.find((n) => n.id === hoveredNodeId) ?? null)
    : null;

  // Show after a short delay; hide immediately when the hover clears.
  useEffect(() => {
    if (delayTimerRef.current) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (!hoveredNodeId) {
      setVisible(false);
      return;
    }
    delayTimerRef.current = window.setTimeout(() => setVisible(true), TOOLTIP_DELAY_MS);
    return () => {
      if (delayTimerRef.current) window.clearTimeout(delayTimerRef.current);
    };
  }, [hoveredNodeId]);

  if (!visible || !node || !hoverPos) return null;

  // Keep the tooltip on-screen relative to the cursor.
  const x = Math.min(hoverPos.x + CURSOR_OFFSET, window.innerWidth - TOOLTIP_MAX_WIDTH - 8);
  const y = Math.min(hoverPos.y + CURSOR_OFFSET, window.innerHeight - TOOLTIP_MAX_HEIGHT - 8);

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: Math.max(8, x),
        top: Math.max(8, y),
        maxWidth: TOOLTIP_MAX_WIDTH,
        maxHeight: TOOLTIP_MAX_HEIGHT,
        overflowY: 'auto',
        padding: '10px 12px',
        backgroundColor: 'rgba(17, 17, 27, 0.97)',
        color: '#f1f5f9',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        fontSize: 12,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        lineHeight: 1.5,
        zIndex: 2147483647,
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
      }}
    >
      {node.text}
    </div>,
    document.body,
  );
}
