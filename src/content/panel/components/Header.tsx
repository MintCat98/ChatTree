// Panel header — acts as drag handle, shows the title, and exposes a close button.
// Marked with data-drag-handle="true" so PanelShell recognizes mousedown events
// originating here as the start of a drag.

import { useCallback, useState, type KeyboardEvent } from 'react';
import { usePanelStore } from '../store/panel-store';

export function Header() {
  const updateSettings = usePanelStore((s) => s.updateSettings);
  const [closeHover, setCloseHover] = useState(false);

  const handleClose = useCallback(() => {
    updateSettings({ panelVisible: false });
  }, [updateSettings]);

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClose();
      }
    },
    [handleClose],
  );

  return (
    <div
      data-drag-handle="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--nav-color-border)',
        background:
          'linear-gradient(180deg, rgba(139,124,246,0.14) 0%, rgba(139,124,246,0) 100%)',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <div
        data-drag-handle="true"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        {/* Small tree-glyph mark next to the title. Decorative only. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
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
      <button
        type="button"
        aria-label="Close panel"
        onClick={handleClose}
        onKeyDown={handleKey}
        onMouseEnter={() => setCloseHover(true)}
        onMouseLeave={() => setCloseHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          background: closeHover ? 'rgba(255,255,255,0.1)' : 'transparent',
          border: 'none',
          color: closeHover ? 'var(--nav-color-text)' : 'var(--nav-color-text-muted)',
          cursor: 'pointer',
          fontSize: 15,
          borderRadius: 6,
          lineHeight: 1,
          transition: 'background var(--nav-duration-fast) ease, color var(--nav-duration-fast) ease',
        }}
      >
        ✕
      </button>
    </div>
  );
}
