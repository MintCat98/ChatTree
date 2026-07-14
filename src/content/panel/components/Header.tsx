// Panel header — drag handle + brand + right column (top: collapse/close, below: icon toggles).
// Marked with data-drag-handle="true" so PanelShell starts a drag from here;
// buttons opt out so their clicks don't drag.

import { useCallback, useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { Bookmark, Tag, Search, Settings, Flag, CircleHelp, Heart } from 'lucide-react';
import { usePanelStore } from '../store/panel-store';
import { useMessages } from '../i18n';
import { GITHUB_URLS, TIMING } from '../../../shared/constants';

const FEEDBACK_URL =
  'https://github.com/MintCat98/ChatTree/issues?q=sort%3Aupdated-desc+is%3Aissue+state%3Aopen+';

export function Header() {
  const t = useMessages();
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
  const generationComplete = usePanelStore((s) => s.generationComplete);
  const setGenerationComplete = usePanelStore((s) => s.setGenerationComplete);

  // Auto-stop the completion blink (issue #166).
  useEffect(() => {
    if (!generationComplete) return;
    const timer = setTimeout(
      () => setGenerationComplete(false),
      TIMING.NOTIFY_BLINK_DURATION,
    );
    return () => clearTimeout(timer);
  }, [generationComplete, setGenerationComplete]);

  const handleClose = useCallback(() => updateSettings({ panelVisible: false }), [updateSettings]);
  const openUserGuide = useCallback(
    () => window.open(GITHUB_URLS.USER_GUIDE, '_blank', 'noopener,noreferrer'),
    [],
  );
  const openFunding = useCallback(
    () => window.open(GITHUB_URLS.SPONSORS, '_blank', 'noopener,noreferrer'),
    [],
  );

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
          <IconButton label={collapsed ? t.expandPanel : t.collapsePanel} expanded={!collapsed} onClick={toggleCollapsed}>
            {collapsed ? '▸' : '▾'}
          </IconButton>
          <IconButton label={t.sendFeedback} tooltip onClick={() => window.open(FEEDBACK_URL, '_blank')}>
            <Flag size={13} />
          </IconButton>
          <IconButton label={t.settings} pressed={settingsOpen} onClick={toggleSettingsOpen}>
            <Settings size={13} />
          </IconButton>
          <IconButton label={t.closePanel} onClick={handleClose}>
            ✕
          </IconButton>
        </div>
      </div>

      {/* Row 2: message count (left) | tool icons (right) — hidden when collapsed */}
      {!collapsed && (
        <div className="nav-header-row">
          <div data-drag-handle="true" className="nav-header-subtitle">
            <IconButton label={t.support} icon="funding" tooltip onClick={openFunding}>
              <Heart size={12} />
            </IconButton>
            <span
              data-drag-handle="true"
              className={generationComplete ? 'nav-header-count is-notifying' : 'nav-header-count'}
            >
              {t.messageCount(count)}
            </span>
          </div>
          <div className="nav-header-tools">
            <IconButton label={t.bookmarksOnly} pressed={bookmarksOnlyFilter} onClick={toggleBookmarksOnlyFilter}>
              <Bookmark size={13} />
            </IconButton>
            <IconButton label={t.tags} pressed={tagPanelOpen} onClick={toggleTagPanel}>
              <Tag size={13} />
            </IconButton>
            <IconButton label={t.search} pressed={searchPanelOpen} onClick={toggleSearchPanel}>
              <Search size={13} />
            </IconButton>
            <IconButton label={t.userGuide} tooltip onClick={openUserGuide}>
              <CircleHelp size={13} />
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
  tooltip?: boolean;
  // Stable identifier for CSS targeting, independent of the (translatable) label.
  // e.g. the sponsor button is styled via [data-icon="funding"] (issue #100).
  icon?: string;
}

function IconButton({ label, onClick, children, expanded, pressed, tooltip, icon }: IconButtonProps) {
  const onKey = useKeyActivate(onClick);
  return (
    <button
      type="button"
      aria-label={label}
      data-label={tooltip ? label : undefined}
      data-icon={icon}
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
