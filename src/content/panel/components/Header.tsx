// Panel header — acts as drag handle, shows the title, and exposes action buttons.
// Right side, left→right: [collapse/expand] [options] [close].
// Marked with data-drag-handle="true" so PanelShell recognizes mousedown events
// originating here as the start of a drag (buttons opt out so clicks don't drag).

import { useCallback, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePanelStore } from '../store/panel-store';

export function Header() {
  const updateSettings = usePanelStore((s) => s.updateSettings);
  const collapsed = usePanelStore((s) => s.collapsed);
  const settingsOpen = usePanelStore((s) => s.settingsOpen);
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const toggleSettingsOpen = usePanelStore((s) => s.toggleSettingsOpen);

  const handleClose = useCallback(() => {
    updateSettings({ panelVisible: false });
  }, [updateSettings]);

  return (
    <div
      data-drag-handle="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px 10px 16px',
        borderBottom: collapsed ? 'none' : '1px solid var(--nav-color-border)',
        background:
          'linear-gradient(180deg, rgba(139,124,246,0.14) 0%, rgba(139,124,246,0) 100%)',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <div data-drag-handle="true" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Small tree-glyph mark next to the title. Decorative only. */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path
            d="M8 2v5M8 7H4v3M8 7h4v3"
            stroke="var(--nav-color-accent)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="2" r="1.6" fill="var(--nav-color-accent)" />
          <circle cx="4" cy="11" r="1.6" fill="var(--nav-color-accent)" />
          <circle cx="12" cy="11" r="1.6" fill="var(--nav-color-accent)" />
        </svg>
        <span
          data-drag-handle="true"
          style={{
            fontSize: 'var(--nav-font-size-base)',
            fontWeight: 600,
            letterSpacing: '0.2px',
            color: 'var(--nav-color-text)',
          }}
        >
          Chat Navigator
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Collapse / expand (issue 03) */}
        <IconButton
          label={collapsed ? '패널 펼치기' : '패널 접기'}
          expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? '▸' : '▾'}
        </IconButton>

        {/* Options entry — toggles the ControlBar (issue 04) */}
        <IconButton
          label="설정"
          active={settingsOpen}
          expanded={settingsOpen}
          onClick={toggleSettingsOpen}
        >
          ⚙
        </IconButton>

        {/* Close */}
        <IconButton label="패널 닫기" onClick={handleClose}>
          ✕
        </IconButton>
      </div>
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;   // persistent "on" state (e.g. options open)
  expanded?: boolean; // aria-expanded value
}

function IconButton({ label, onClick, children, active, expanded }: IconButtonProps) {
  const [hover, setHover] = useState(false);
  const on = hover || active;

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick],
  );

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={handleKey}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        background: on ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: 'none',
        color: on ? 'var(--nav-color-text)' : 'var(--nav-color-text-muted)',
        cursor: 'pointer',
        fontSize: 14,
        borderRadius: 6,
        lineHeight: 1,
        transition: 'background var(--nav-duration-fast) ease, color var(--nav-duration-fast) ease',
      }}
    >
      {children}
    </button>
  );
}
