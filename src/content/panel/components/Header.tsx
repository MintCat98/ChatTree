// Panel header — drag handle + brand (icon, title, message count) + actions.
// Actions, left→right: [collapse/expand] [Settings pill] [close].
// Marked with data-drag-handle="true" so PanelShell starts a drag from here;
// buttons opt out so their clicks don't drag.

import { useCallback, type KeyboardEvent, type ReactNode } from 'react';
import { usePanelStore } from '../store/panel-store';

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
      className={collapsed ? 'nav-header is-collapsed' : 'nav-header'}
    >
      {/* Brand */}
      <div data-drag-handle="true" className="nav-header-brand">
        <span data-drag-handle="true" className="nav-header-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 4.2c0-.66.54-1.2 1.2-1.2h7.6c.66 0 1.2.54 1.2 1.2v5.1c0 .66-.54 1.2-1.2 1.2H7l-3 2.5v-2.5h-0c-.66 0-1.2-.54-1.2-1.2V4.2Z"
              stroke="var(--nav-color-accent)"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div data-drag-handle="true" className="nav-header-text">
          <span data-drag-handle="true" className="nav-header-title">
            Chat Navigator
          </span>
          <span data-drag-handle="true" className="nav-header-subtitle">
            메시지 {count}개
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="nav-header-actions">
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
  const onKey = useKeyActivate(onClick);
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
      onKeyDown={onKey}
      className="nav-icon-btn"
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
  const onKey = useKeyActivate(onClick);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      onKeyDown={onKey}
      className="nav-pill-btn"
    >
      {children}
    </button>
  );
}
