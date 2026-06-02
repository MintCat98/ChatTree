// Control bar at the bottom of the panel.
// Four controls: direction (fixed), position, opacity, sort. Every change is
// committed via store.updateSettings, which the persist middleware writes to
// localStorage automatically.

import { useState, type ChangeEvent } from 'react';
import { usePanelStore } from '../store/panel-store';
import type { UserSettings } from '@shared/types';

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--nav-font-size-sm)',
  color: 'var(--nav-color-text-muted)',
  marginRight: 8,
  minWidth: 44,
  letterSpacing: '0.2px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '3px 0',
  fontSize: 'var(--nav-font-size-sm)',
};

const controlStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'var(--nav-color-text)',
  border: '1px solid var(--nav-color-border)',
  borderRadius: 'var(--nav-border-radius-sm)',
  padding: '5px 8px',
  fontSize: 'var(--nav-font-size-sm)',
  fontFamily: 'var(--nav-font-family)',
  outline: 'none',
  transition: 'background var(--nav-duration-fast) ease, border-color var(--nav-duration-fast) ease',
};

export function ControlBar() {
  const settings = usePanelStore((s) => s.settings);
  const updateSettings = usePanelStore((s) => s.updateSettings);
  const [sortHover, setSortHover] = useState(false);

  const handlePosition = (e: ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ panelPosition: e.target.value as UserSettings['panelPosition'] });
  };

  const handleOpacity = (e: ChangeEvent<HTMLInputElement>) => {
    updateSettings({ backgroundOpacity: Number(e.target.value) });
  };

  const handleSortToggle = () => {
    updateSettings({ sortOrder: settings.sortOrder === 'asc' ? 'desc' : 'asc' });
  };

  return (
    <div
      data-testid="control-bar"
      style={{
        padding: '10px 16px 12px',
        borderTop: '1px solid var(--nav-color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Direction — Top-Down is fixed; Left-Right is reserved for a future PR. */}
      <div style={rowStyle}>
        <span style={labelStyle}>방향</span>
        <select
          disabled
          value={settings.panelDirection}
          style={{ ...controlStyle, opacity: 0.6, cursor: 'not-allowed' }}
        >
          <option value="top-down">Top-Down</option>
          <option value="left-right">Left-Right (coming soon)</option>
        </select>
      </div>

      {/* Position */}
      <div style={rowStyle}>
        <span style={labelStyle}>위치</span>
        <select
          value={settings.panelPosition}
          onChange={handlePosition}
          style={{ ...controlStyle, cursor: 'pointer' }}
        >
          <option value="top-left">좌상단</option>
          <option value="top-right">우상단</option>
          <option value="bottom-left">좌하단</option>
          <option value="bottom-right">우하단</option>
        </select>
      </div>

      {/* Background opacity */}
      <div style={rowStyle}>
        <span style={labelStyle}>투명도</span>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={settings.backgroundOpacity}
          onChange={handleOpacity}
          aria-label="Background opacity"
          style={{ flex: 1 }}
        />
        <span
          style={{
            minWidth: 38,
            textAlign: 'right',
            color: 'var(--nav-color-text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(settings.backgroundOpacity * 100)}%
        </span>
      </div>

      {/* Sort order */}
      <div style={rowStyle}>
        <span style={labelStyle}>정렬</span>
        <button
          type="button"
          onClick={handleSortToggle}
          onMouseEnter={() => setSortHover(true)}
          onMouseLeave={() => setSortHover(false)}
          aria-label={`Current sort: ${settings.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
          style={{
            ...controlStyle,
            cursor: 'pointer',
            textAlign: 'left',
            background: sortHover ? 'rgba(139,124,246,0.18)' : 'rgba(255, 255, 255, 0.06)',
            borderColor: sortHover ? 'var(--nav-color-accent)' : 'var(--nav-color-border)',
          }}
        >
          {settings.sortOrder === 'asc' ? '↑ 오래된 순' : '↓ 최신 순'}
        </button>
      </div>
    </div>
  );
}
