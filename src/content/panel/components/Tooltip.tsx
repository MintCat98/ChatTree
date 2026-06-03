// Tooltip showing the full prompt text when a node is hovered (issue 01).
// Anchored to the cursor position (store.hoverPos) rather than the node element,
// because nodes live inside a closed Shadow DOM and can't be located via
// document.querySelector. Rendered through a Portal to document.body so it is not
// clipped by the panel; colors are literal (not --nav-* vars) since those tokens
// are scoped to the Shadow :host and don't apply at document.body.
//
// Sizing: a FIXED width so every tooltip looks consistent and never stretches
// too wide; long text wraps and scrolls vertically.
// Placement: shows on whichever side of the cursor (right vs left) has more room.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelStore } from '../store/panel-store';

const TOOLTIP_DELAY_MS = 300;
const TOOLTIP_WIDTH = 280;      // fixed box width for visual consistency
const TOOLTIP_MAX_HEIGHT = 200; // long prompts scroll inside this
const CURSOR_OFFSET = 16;
const EDGE_MARGIN = 8;

interface Pos {
  left: number;
  top: number;
}

export function Tooltip() {
  const hoveredNodeId = usePanelStore((s) => s.hoveredNodeId);
  const hoverPos = usePanelStore((s) => s.hoverPos);
  const tree = usePanelStore((s) => s.tree);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLDivElement>(null);
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
      setPos(null); // recompute placement fresh on the next hover
      return;
    }
    delayTimerRef.current = window.setTimeout(() => setVisible(true), TOOLTIP_DELAY_MS);
    return () => {
      if (delayTimerRef.current) window.clearTimeout(delayTimerRef.current);
    };
  }, [hoveredNodeId]);

  // After the tooltip is in the DOM, measure its height and pick the side with
  // more room. Width is fixed (TOOLTIP_WIDTH), so the only horizontal decision is
  // left-of-cursor vs right-of-cursor.
  useLayoutEffect(() => {
    if (!visible || !node || !hoverPos || !ref.current) return;

    const h = ref.current.offsetHeight;
    const spaceRight = window.innerWidth - hoverPos.x;
    const spaceLeft = hoverPos.x;
    // Prefer the right; flip to the left only when the right can't fit the box
    // and the left genuinely has more room.
    const placeLeft = spaceRight < TOOLTIP_WIDTH + CURSOR_OFFSET + EDGE_MARGIN && spaceLeft > spaceRight;

    let left = placeLeft
      ? hoverPos.x - CURSOR_OFFSET - TOOLTIP_WIDTH
      : hoverPos.x + CURSOR_OFFSET;
    left = Math.max(EDGE_MARGIN, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - EDGE_MARGIN));

    let top = hoverPos.y + CURSOR_OFFSET;
    top = Math.max(EDGE_MARGIN, Math.min(top, window.innerHeight - h - EDGE_MARGIN));

    setPos({ left, top });
  }, [visible, node, hoverPos]);

  if (!visible || !node || !hoverPos) return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{
        position: 'fixed',
        // Render off-screen for the first measuring pass, then snap into place.
        left: pos ? pos.left : -9999,
        top: pos ? pos.top : -9999,
        opacity: pos ? 1 : 0,
        width: TOOLTIP_WIDTH,
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
        overflowWrap: 'break-word',
        transition: 'opacity 80ms ease',
      }}
    >
      {node.text}
    </div>,
    document.body,
  );
}
