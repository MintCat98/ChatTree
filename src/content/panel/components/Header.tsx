// Panel header — drag handle + brand + right column (top: collapse/close, below: icon toggles).
// Marked with data-drag-handle="true" so PanelShell starts a drag from here;
// buttons opt out so their clicks don't drag.

import { useCallback, type KeyboardEvent, type ReactNode } from 'react';
import { Bookmark, Tag, Search, Settings } from 'lucide-react';
import { usePanelStore } from '../store/panel-store';

export function Header() {
  const updateSettings = usePanelStore((s) => s.updateSettings);
  const collapsed = usePanelStore((s) => s.collapsed);
  const settingsOpen = usePanelStore((s) => s.settingsOpen);
  const bookmarksOnlyFilter = usePanelStore((s) => s.bookmarksOnlyFilter);
  const tagPanelOpen = usePanelStore((s) => s.tagPanelOpen);
  const searchPanelOpen = usePanelStore((s) => s.searchPanelOpen);
  const toggleCollapsed = usePanelStore((s) => s.toggleCollapsed);
  const toggleSettingsOpen = usePanelStore((s) => s.toggleSettingsOpen);
  const toggleBookmarksOnlyFilter = usePanelStore((s) => s.toggleBookmarksOnlyFilter);
  const toggleTagPanel = usePanelStore((s) => s.toggleTagPanel);
  const toggleSearchPanel = usePanelStore((s) => s.toggleSearchPanel);
  const count = usePanelStore((s) => s.tree?.nodes.length ?? 0);

  const handleClose = useCallback(() => updateSettings({ panelVisible: false }), [updateSettings]);

  return (
    <div
      data-drag-handle="true"
      className={collapsed ? 'nav-header is-collapsed' : 'nav-header'}
    >
      {/* Row 1: logo + title (left) | collapse + close (right) */}
      <div className="nav-header-row">
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
          <span data-drag-handle="true" className="nav-header-title">
            ChatTree
          </span>
        </div>
        <div className="nav-header-controls">
          <IconButton label={collapsed ? '패널 펼치기' : '패널 접기'} expanded={!collapsed} onClick={toggleCollapsed}>
            {collapsed ? '▸' : '▾'}
          </IconButton>
          <IconButton label="패널 닫기" onClick={handleClose}>
            ✕
          </IconButton>
        </div>
      </div>

      {/* Row 2: message count (left) | tool icons (right) — hidden when collapsed */}
      {!collapsed && (
        <div className="nav-header-row">
          <span data-drag-handle="true" className="nav-header-subtitle">
            메시지 {count}개
          </span>
          <div className="nav-header-tools">
            <IconButton label="북마크만 보기" pressed={bookmarksOnlyFilter} onClick={toggleBookmarksOnlyFilter}>
              <Bookmark size={13} />
            </IconButton>
            <IconButton label="태그 패널" pressed={tagPanelOpen} onClick={toggleTagPanel}>
              <Tag size={13} />
            </IconButton>
            <IconButton label="검색" pressed={searchPanelOpen} onClick={toggleSearchPanel}>
              <Search size={13} />
            </IconButton>
            <IconButton label="설정" pressed={settingsOpen} onClick={toggleSettingsOpen}>
              <Settings size={13} />
            </IconButton>
          </div>
        </div>
      )}
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
  pressed?: boolean;
}

function IconButton({ label, onClick, children, expanded, pressed }: IconButtonProps) {
  const onKey = useKeyActivate(onClick);
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-pressed={pressed}
      onClick={onClick}
      onKeyDown={onKey}
      className="nav-icon-btn"
    >
      {children}
    </button>
  );
}
