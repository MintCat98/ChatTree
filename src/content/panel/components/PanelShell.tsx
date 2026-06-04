// Top-level panel wrapper.
// Manages position (panelPosition), width (panelWidth + drag-resize), opacity
// (backgroundOpacity), and drag movement. Applies a slide-in animation on mount.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePanelStore } from '../store/panel-store';
import { PANEL_WIDTH_MIN, PANEL_WIDTH_MAX } from '@shared/types';

const PANEL_INITIAL_HEIGHT = 600; // Estimated panel height for bottom-anchor initial placement.
const DRAG_BOTTOM_CLEARANCE = 100; // Minimum px above the viewport bottom edge during drag.

interface PanelShellProps {
  children: ReactNode;
}

interface Position {
  x: number;
  y: number;
}

// Compute the initial coordinate from panelPosition before any drag.
function getInitialPosition(panelPosition: string, width: number): Position {
  const margin = 16;
  switch (panelPosition) {
    case 'top-left':
      return { x: margin, y: margin };
    case 'bottom-left':
      return { x: margin, y: window.innerHeight - PANEL_INITIAL_HEIGHT - margin };
    case 'bottom-right':
      return {
        x: window.innerWidth - width - margin,
        y: window.innerHeight - PANEL_INITIAL_HEIGHT - margin,
      };
    case 'top-right':
    default:
      return { x: window.innerWidth - width - margin, y: margin };
  }
}

export function PanelShell({ children }: PanelShellProps) {
  const settings = usePanelStore((s) => s.settings);
  const width = settings.panelWidth;

  const [position, setPosition] = useState<Position>(() =>
    getInitialPosition(settings.panelPosition, width),
  );
  const dragOffsetRef = useRef<Position | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Recompute initial position whenever panelPosition changes. (Width changes are
  // handled by clamping in the style below, so we don't reposition mid-resize.)
  useEffect(() => {
    setPosition(getInitialPosition(settings.panelPosition, usePanelStore.getState().settings.panelWidth));
  }, [settings.panelPosition]);

  // One document-level listener pair handles both drag-move and drag-resize.
  // Stays attached even when the cursor leaves the Shadow DOM region.
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      // Resize takes priority when active.
      if (resizeRef.current) {
        const delta = e.clientX - resizeRef.current.startX;
        const next = Math.max(
          PANEL_WIDTH_MIN,
          Math.min(PANEL_WIDTH_MAX, resizeRef.current.startWidth + delta),
        );
        // Live update without writing to chrome.storage on every frame.
        usePanelStore.getState().hydrateSettings({ panelWidth: next });
        return;
      }
      if (!dragOffsetRef.current) return;
      const w = usePanelStore.getState().settings.panelWidth;
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      const clampedX = Math.max(0, Math.min(window.innerWidth - w, newX));
      const clampedY = Math.max(0, Math.min(window.innerHeight - DRAG_BOTTOM_CLEARANCE, newY));
      setPosition({ x: clampedX, y: clampedY });
    }
    function handleMouseUp() {
      if (resizeRef.current) {
        resizeRef.current = null;
        document.body.style.userSelect = '';
        // Persist the final width to chrome.storage once (so the popup sees it).
        usePanelStore.getState().updateSettings({
          panelWidth: usePanelStore.getState().settings.panelWidth,
        });
        return;
      }
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

  // Triggered by children that opt-in via data-drag-handle="true" (the Header).
  function startDrag(e: React.MouseEvent) {
    dragOffsetRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    document.body.style.userSelect = 'none';
  }

  function startResize(e: React.MouseEvent) {
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startWidth: width };
    document.body.style.userSelect = 'none';
  }

  // Theme-aware background: --nav-color-bg-rgb is a space-separated RGB triple
  // (overridden per theme in panel.css). Compose with the opacity setting.
  const bgColor = `rgb(var(--nav-color-bg-rgb) / ${settings.backgroundOpacity})`;
  const clampedLeft = Math.max(0, Math.min(window.innerWidth - width, position.x));

  return (
    <div
      data-testid="panel-shell"
      style={{
        position: 'fixed',
        left: clampedLeft,
        top: position.y,
        width,
        maxHeight: '90vh',
        backgroundColor: bgColor,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
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
        if ((e.target as HTMLElement).dataset.dragHandle === 'true') {
          startDrag(e);
        }
      }}
    >
      {children}
      {/* Right-edge drag-resize handle (issue 02). */}
      <div
        className="nav-resize-handle"
        onMouseDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="패널 너비 조절"
      />
    </div>
  );
}
