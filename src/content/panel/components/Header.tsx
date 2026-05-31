// Panel header — acts as drag handle, shows the title, and exposes a close button.
// Marked with data-drag-handle="true" so PanelShell recognizes mousedown events
// originating here as the start of a drag.

import { useCallback, type KeyboardEvent } from 'react';
import { usePanelStore } from '../store/panel-store';

export function Header() {
  const updateSettings = usePanelStore((s) => s.updateSettings);

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
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      <span
        data-drag-handle="true"
        style={{
          fontSize: 'var(--nav-font-size-base)',
          fontWeight: 600,
          color: 'var(--nav-color-text)',
        }}
      >
        Chat Navigator
      </span>
      <button
        type="button"
        aria-label="Close panel"
        onClick={handleClose}
        onKeyDown={handleKey}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--nav-color-text-muted)',
          cursor: 'pointer',
          fontSize: 16,
          padding: 4,
          borderRadius: 4,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
