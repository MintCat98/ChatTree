// Top-level panel wrapper.
// Manages position (panelPosition), width (panelWidth + drag-resize), opacity
// (backgroundOpacity), and drag movement. Applies a slide-in animation on mount.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePanelStore } from '../store/panel-store';
import { useMessages } from '../i18n';
import { PANEL_WIDTH_MIN, PANEL_WIDTH_MAX } from '@shared/types';
import { InteractiveMap } from './InteractiveMap';

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
  const t = useMessages();
  const settings = usePanelStore((s) => s.settings);
  const width = settings.panelWidth;
  const isSidebar = settings.panelMode === 'sidebar';

  const [position, setPosition] = useState<Position>(() =>
    getInitialPosition(settings.panelPosition, width),
  );
  const dragOffsetRef = useRef<Position | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Recompute initial position whenever panelPosition changes. (Width changes are
  // handled by clamping in the style below, so we don't reposition mid-resize.)
  useEffect(() => {
    setPosition(getInitialPosition(settings.panelPosition, width));
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

  // Recompute position on window resize to keep the panel in view.
  useEffect(() => {
    function handleWindowResize() {
      const w = usePanelStore.getState().settings.panelWidth;
      setPosition(getInitialPosition(settings.panelPosition, w));
    }
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [settings.panelPosition]);

  // Sidebar mode: push claude.ai's main content to the left so the sidebar doesn't overlay the chat area.
  useEffect(() => {
    const container = document.querySelector('#root') as HTMLElement | null;
    if (!container) return;

    if (isSidebar) {
      container.style.transition = 'margin-right 200ms ease';
      container.style.marginRight = `${width}px`;
    } else {
      container.style.marginRight = '';
    }

    return () => {
      container.style.marginRight = '';
    };
  }, [isSidebar, width]);

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

  // Sidebar mode
  if (isSidebar) {
    return (
      <div
        data-testid="panel-shell"
        className="nav-panel nav-panel--sidebar"
        style={{
          '--panel-w': `${width}px`,
          '--bg-alpha': settings.backgroundOpacity,
        } as React.CSSProperties}
      >
        {/* Top: Tree-map components*/}
        <div className="nav-sidebar-top">
          {children}
        </div>

        {/* Bottom: Interactive Map*/}
        <div className="nav-sidebar-bottom">
          <InteractiveMap />
        </div>

        {/* left resize handle */}
        <div
          className="nav-resize-handle nav-resize-handle--sidebar"
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label={t.resizeAria}
        />
      </div>
    );
  }

  const clampedLeft = Math.max(0, Math.min(window.innerWidth - width, position.x));

  return (
    <div
      data-testid="panel-shell"
      className="nav-panel"
      style={{
        '--panel-x': `${clampedLeft}px`,
        '--panel-y': `${position.y}px`,
        '--panel-w': `${width}px`,
        '--bg-alpha': settings.backgroundOpacity,
      } as React.CSSProperties}
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
        aria-label={t.resizeAria}
      />
    </div>
  );
}
