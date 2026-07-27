// Tooltip showing the full prompt text when a node is hovered (issue 01).
// Anchored to the cursor position (store.hoverPos) — nodes live inside a closed
// Shadow DOM and can't be located via document.querySelector.
// Fixed width for visual consistency; placement picks the side with more room.
// Inline styles are intentional: Tooltip renders via Portal into document.body, outside the Shadow DOM, so --nav-* CSS variables and panel.css classes don't reach it.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePanelStore } from '../store/panel-store';
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
  // User-configurable hover delay (issue #146). 0 = show instantly.
  const tooltipDelay = usePanelStore((s) => s.settings.tooltipDelay);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const delayTimerRef = useRef<number | null>(null);

  const node = hoveredNodeId
    ? (tree?.nodes.find((n) => n.id === hoveredNodeId) ?? null)
    : null;

  // Show after the configured delay; hide immediately when the hover clears.
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
    if (tooltipDelay <= 0) {
      setVisible(true); // instant: skip the timer entirely
      return;
    }
    delayTimerRef.current = window.setTimeout(() => setVisible(true), tooltipDelay);
    return () => {
      if (delayTimerRef.current) window.clearTimeout(delayTimerRef.current);
    };
  }, [hoveredNodeId, tooltipDelay]);

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

  return (
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
        padding: 'var(--nav-spacing-5) var(--nav-spacing-6)',
        backgroundColor: 'rgb(var(--nav-color-bg-rgb) / 0.97)',
        color: 'var(--nav-color-text)',
        border: 'var(--nav-border-width) solid var(--nav-color-border)',
        borderRadius: 'var(--nav-radius-md)',
        boxShadow: 'var(--nav-panel-shadow)',
        fontSize: 'var(--nav-font-size-md)',
        fontFamily: 'var(--nav-font-family)',
        lineHeight: 1.5,
        zIndex: 'var(--nav-z-index)' as unknown as number,
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        transition: 'opacity 80ms ease',
      }}
    >
      {node.text}
    </div>
  );
}
