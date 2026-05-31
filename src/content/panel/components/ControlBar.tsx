// Control bar at the bottom of the panel.
// Four controls: direction (fixed), position, opacity, sort. Every change is
// committed via store.updateSettings, which the persist middleware writes to
// localStorage automatically.

import type { ChangeEvent } from 'react';
import { usePanelStore } from '../store/panel-store';
import type { UserSettings } from '@shared/types';

const labelStyle: React.CSSProperties = {
  fontSize: 'var(--nav-font-size-sm)',
  color: 'var(--nav-color-text-muted)',
  marginRight: 6,
  minWidth: 44,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '4px 0',
  fontSize: 'var(--nav-font-size-sm)',
};

const controlStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'var(--nav-color-text)',
  border: '1px solid var(--nav-color-border)',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 'var(--nav-font-size-sm)',
  fontFamily: 'var(--nav-font-family)',
};

export function ControlBar() {
  const settings = usePanelStore((s) => s.settings);
  const updateSettings = usePanelStore((s) => s.updateSettings);

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
        padding: '8px 16px',
        borderTop: '1px solid var(--nav-color-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* Direction — Top-Down is fixed; Left-Right is reserved for a future PR. */}
      <div style={rowStyle}>
        <span style={labelStyle}>방향</span>
        <select disabled value={settings.panelDirection} style={controlStyle}>
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
          style={controlStyle}
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
        <span style={{ minWidth: 36, textAlign: 'right' }}>
          {Math.round(settings.backgroundOpacity * 100)}%
        </span>
      </div>

      {/* Sort order */}
      <div style={rowStyle}>
        <span style={labelStyle}>정렬</span>
        <button
          type="button"
          onClick={handleSortToggle}
          aria-label={`Current sort: ${settings.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
          style={{
            ...controlStyle,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {settings.sortOrder === 'asc' ? '↑ 오래된 순' : '↓ 최신 순'}
        </button>
      </div>
    </div>
  );
}
