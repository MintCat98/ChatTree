// Tooltip showing the full prompt text when a node is hovered.
// Watches store.hoveredNodeId, waits 300ms before becoming visible, and
// renders via Portal so the tooltip is not clipped by surrounding SVG.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePanelStore } from '../store/panel-store';

const TOOLTIP_DELAY_MS = 300;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_MAX_HEIGHT = 200;

interface TooltipPosition {
  x: number;
  y: number;
}

export function Tooltip() {
  const hoveredNodeId = usePanelStore((s) => s.hoveredNodeId);
  const tree = usePanelStore((s) => s.tree);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const delayTimerRef = useRef<number | null>(null);

  // Resolve the hovered node's full record from the store.
  const node = hoveredNodeId
    ? tree?.nodes.find((n) => n.id === hoveredNodeId) ?? null
    : null;

  // React to hoveredNodeId transitions.
  useEffect(() => {
    if (delayTimerRef.current) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    if (!hoveredNodeId) {
      setVisible(false);
      return;
    }
    delayTimerRef.current = window.setTimeout(() => {
      // Locate the hovered node element in the DOM to anchor the tooltip.
      const el = document.querySelector(`[data-nav-id="${hoveredNodeId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const x = Math.min(
          rect.right + 8,
          window.innerWidth - TOOLTIP_MAX_WIDTH - 8,
        );
        const y = Math.max(8, Math.min(rect.top, window.innerHeight - TOOLTIP_MAX_HEIGHT - 8));
        setPosition({ x, y });
      }
      setVisible(true);
    }, TOOLTIP_DELAY_MS);
    return () => {
      if (delayTimerRef.current) {
        window.clearTimeout(delayTimerRef.current);
      }
    };
  }, [hoveredNodeId]);

  if (!visible || !node) return null;

  // Portal target. document.body works for now; in stricter Shadow-DOM-isolated
  // environments a dedicated root inside the panel's shadow tree may be needed.
  const portalRoot = document.body;

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        maxWidth: TOOLTIP_MAX_WIDTH,
        maxHeight: TOOLTIP_MAX_HEIGHT,
        overflowY: 'auto',
        padding: '12px 14px',
        backgroundColor: 'rgba(17, 17, 27, 0.95)',
        color: 'var(--nav-color-text)',
        border: '1px solid var(--nav-color-border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        fontSize: 'var(--nav-font-size-sm)',
        fontFamily: 'var(--nav-font-family)',
        lineHeight: 1.5,
        zIndex: 'var(--nav-z-index)' as unknown as number,
        pointerEvents: 'none', // The tooltip itself never captures hover.
        whiteSpace: 'pre-wrap',
      }}
    >
      {node.text}
    </div>,
    portalRoot,
  );
}
