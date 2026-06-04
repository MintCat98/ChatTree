// Panel header — drag handle + brand (icon, title, message count) + actions.
// Actions, left→right: [collapse/expand] [Settings pill] [close].
// Marked with data-drag-handle="true" so PanelShell starts a drag from here;
// buttons opt out so their clicks don't drag.

import { useCallback, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePanelStore } from '../store/panel-store';

const ICON_BTN_SIZE = 26;

export function Header() {
  const updateSettings = usePanelStore((s) => s.updateSettings);
  const collapsed = usePanelStore((s) => s.collapsed);
  const settingsOpen = usePanelStore((s) => s.settingsOpen);
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const toggleSettingsOpen = usePanelStore((s) => s.toggleSettingsOpen);
  const count = usePanelStore((s) => s.tree?.nodes.length ?? 0);

  const handleClose = useCallback(() => updateSettings({ panelVisible: false }), [updateSettings]);

  return (
    <div
      data-drag-handle="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '12px 12px 12px 14px',
        borderBottom: collapsed ? 'none' : '1px solid var(--nav-color-divider)',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* Brand */}
      <div data-drag-handle="true" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          data-drag-handle="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 8,
            background: 'var(--nav-color-accent-soft)',
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 4.2c0-.66.54-1.2 1.2-1.2h7.6c.66 0 1.2.54 1.2 1.2v5.1c0 .66-.54 1.2-1.2 1.2H7l-3 2.5v-2.5h-0c-.66 0-1.2-.54-1.2-1.2V4.2Z"
              stroke="var(--nav-color-accent)"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div data-drag-handle="true" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            data-drag-handle="true"
            style={{
              fontSize: 'var(--nav-font-size-base)',
              fontWeight: 700,
              letterSpacing: '0.1px',
              color: 'var(--nav-color-text)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
            }}
          >
            Chat Navigator
          </span>
          <span
            data-drag-handle="true"
            style={{
              fontSize: 'var(--nav-font-size-sm)',
              color: 'var(--nav-color-text-muted)',
              lineHeight: 1.3,
            }}
          >
            메시지 {count}개
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <IconButton label={collapsed ? '패널 펼치기' : '패널 접기'} expanded={!collapsed} onClick={toggleCollapsed}>
          {collapsed ? '▸' : '▾'}
        </IconButton>

        <PillButton label="설정" active={settingsOpen} onClick={toggleSettingsOpen}>
          설정
        </PillButton>

        <IconButton label="패널 닫기" onClick={handleClose}>
          ✕
        </IconButton>
      </div>
    </div>
  );
}

function useKeyActivate(onClick: () => void) {
  return useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick],
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  expanded?: boolean;
}

function IconButton({ label, onClick, children, expanded }: IconButtonProps) {
  const [hover, setHover] = useState(false);
  const onKey = useKeyActivate(onClick);
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={onKey}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: ICON_BTN_SIZE,
        height: ICON_BTN_SIZE,
        background: hover ? 'var(--nav-color-surface-2)' : 'transparent',
        border: 'none',
        color: hover ? 'var(--nav-color-text)' : 'var(--nav-color-text-muted)',
        cursor: 'pointer',
        fontSize: 'var(--nav-font-size-base)',
        borderRadius: 8,
        lineHeight: 1,
        transition: 'background var(--nav-duration-fast) ease, color var(--nav-duration-fast) ease',
      }}
    >
      {children}
    </button>
  );
}

interface PillButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}

function PillButton({ label, onClick, children, active }: PillButtonProps) {
  const [hover, setHover] = useState(false);
  const onKey = useKeyActivate(onClick);
  const on = active || hover;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={onKey}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 24,
        padding: '0 11px',
        background: active ? 'var(--nav-color-accent-soft)' : hover ? 'var(--nav-color-surface-2)' : 'transparent',
        border: `1px solid ${on ? 'var(--nav-color-accent)' : 'var(--nav-color-border)'}`,
        color: active ? 'var(--nav-color-accent)' : 'var(--nav-color-text-secondary)',
        cursor: 'pointer',
        fontSize: 'var(--nav-font-size-sm)',
        fontWeight: 600,
        fontFamily: 'var(--nav-font-family)',
        borderRadius: 999,
        lineHeight: 1,
        transition: 'background var(--nav-duration-fast) ease, border-color var(--nav-duration-fast) ease, color var(--nav-duration-fast) ease',
      }}
    >
      {children}
    </button>
  );
}
