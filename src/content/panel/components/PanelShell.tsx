// Top-level panel wrapper.
// Manages position (panelPosition), opacity (backgroundOpacity), and drag movement.
// Applies a slide-in + fade-in animation on first mount.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePanelStore } from '../store/panel-store';

const PANEL_WIDTH = 280;
const PANEL_HEIGHT_MAX = 600; // Conservative estimate; actual height grows with content.

interface PanelShellProps {
  children: ReactNode;
}

interface Position {
  x: number;
  y: number;
}

// Compute the initial coordinate from panelPosition before any drag.
function getInitialPosition(panelPosition: string): Position {
  const margin = 16;
  switch (panelPosition) {
    case 'top-left':
      return { x: margin, y: margin };
    case 'bottom-left':
      return { x: margin, y: window.innerHeight - PANEL_HEIGHT_MAX - margin };
    case 'bottom-right':
      return {
        x: window.innerWidth - PANEL_WIDTH - margin,
        y: window.innerHeight - PANEL_HEIGHT_MAX - margin,
      };
    case 'top-right':
    default:
      return { x: window.innerWidth - PANEL_WIDTH - margin, y: margin };
  }
}

export function PanelShell({ children }: PanelShellProps) {
  const settings = usePanelStore((s) => s.settings);
  const [position, setPosition] = useState<Position>(() =>
    getInitialPosition(settings.panelPosition),
  );
  const dragOffsetRef = useRef<Position | null>(null);

  // Recompute initial position whenever panelPosition setting changes.
  useEffect(() => {
    setPosition(getInitialPosition(settings.panelPosition));
  }, [settings.panelPosition]);

  // Register mousemove/mouseup on document so dragging continues even when the
  // cursor leaves the Shadow DOM region. Shadow DOM only isolates styles, not
  // global events, so attaching to document is safe.
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragOffsetRef.current) return;
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      // Clamp to viewport so the panel never goes off-screen.
      const clampedX = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - 100, newY));
      setPosition({ x: clampedX, y: clampedY });
    }
    function handleMouseUp() {
      if (dragOffsetRef.current) {
        dragOffsetRef.current = null;
        document.body.style.userSelect = '';
      }
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Triggered by children that opt-in via data-drag-handle="true" (typically the Header).
  function startDrag(e: React.MouseEvent) {
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.body.style.userSelect = 'none';
  }

  // Project the opacity setting onto the rgba alpha channel of the background color.
  const bgColor = `rgba(17, 17, 27, ${settings.backgroundOpacity})`;

  return (
    <div
      data-testid="panel-shell"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: PANEL_WIDTH,
        maxHeight: '90vh',
        backgroundColor: bgColor,
        backdropFilter: 'blur(8px)',
        borderRadius: 'var(--nav-border-radius)',
        boxShadow: 'var(--nav-panel-shadow)',
        border: '1px solid var(--nav-color-border)',
        zIndex: 'var(--nav-z-index)' as unknown as number,
        fontFamily: 'var(--nav-font-family)',
        color: 'var(--nav-color-text)',
        animation: `nav-slide-in var(--nav-duration-base) ease-out`,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={(e) => {
        // Only the Header (and other opted-in elements) can start a drag.
        if ((e.target as HTMLElement).dataset.dragHandle === 'true') {
          startDrag(e);
        }
      }}
    >
      <style>{`
        @keyframes nav-slide-in {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      {children}
    </div>
  );
}
