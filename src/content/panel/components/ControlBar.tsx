// Control bar (settings) shown under the header when the Settings button is on.
// Controls: direction (fixed), position, width, opacity, sort, theme. Every change
// is committed via store.updateSettings → persisted to localStorage + mirrored to
// chrome.storage.local (so the popup stays in sync).

import { useState, type ChangeEvent } from 'react';
import { usePanelStore } from '../store/panel-store';
import type { UserSettings } from '@shared/types';
import { PANEL_WIDTH_MIN, PANEL_WIDTH_MAX } from '@shared/types';

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
  background: 'var(--nav-color-surface-2)',
  color: 'var(--nav-color-text)',
  border: '1px solid var(--nav-color-border)',
  borderRadius: 'var(--nav-border-radius-sm)',
  padding: '5px 8px',
  fontSize: 'var(--nav-font-size-sm)',
  fontFamily: 'var(--nav-font-family)',
  outline: 'none',
  transition: 'background var(--nav-duration-fast) ease, border-color var(--nav-duration-fast) ease',
};

const readoutStyle: React.CSSProperties = {
  minWidth: 38,
  textAlign: 'right',
  color: 'var(--nav-color-text-secondary)',
  fontVariantNumeric: 'tabular-nums',
};

export function ControlBar() {
  const settings = usePanelStore((s) => s.settings);
  const updateSettings = usePanelStore((s) => s.updateSettings);
  const [sortHover, setSortHover] = useState(false);

  const handlePosition = (e: ChangeEvent<HTMLSelectElement>) =>
    updateSettings({ panelPosition: e.target.value as UserSettings['panelPosition'] });
  const handleWidth = (e: ChangeEvent<HTMLInputElement>) =>
    updateSettings({ panelWidth: Number(e.target.value) });
  const handleOpacity = (e: ChangeEvent<HTMLInputElement>) =>
    updateSettings({ backgroundOpacity: Number(e.target.value) });
  const handleSortToggle = () =>
    updateSettings({ sortOrder: settings.sortOrder === 'asc' ? 'desc' : 'asc' });
  const handleTheme = (e: ChangeEvent<HTMLSelectElement>) =>
    updateSettings({ themeMode: e.target.value as UserSettings['themeMode'] });

  return (
    <div
      data-testid="control-bar"
      style={{
        padding: '10px 14px 12px',
        borderTop: '1px solid var(--nav-color-divider)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Direction — Top-Down is fixed; Left-Right is reserved for a future PR. */}
      <div style={rowStyle}>
        <span style={labelStyle}>방향</span>
        <select disabled value={settings.panelDirection} style={{ ...controlStyle, opacity: 0.6, cursor: 'not-allowed' }}>
          <option value="top-down">Top-Down</option>
          <option value="left-right">Left-Right (coming soon)</option>
        </select>
      </div>

      {/* Position */}
      <div style={rowStyle}>
        <span style={labelStyle}>위치</span>
        <select value={settings.panelPosition} onChange={handlePosition} style={{ ...controlStyle, cursor: 'pointer' }}>
          <option value="top-left">좌상단</option>
          <option value="top-right">우상단</option>
          <option value="bottom-left">좌하단</option>
          <option value="bottom-right">우하단</option>
        </select>
      </div>

      {/* Panel width (issue 02) */}
      <div style={rowStyle}>
        <span style={labelStyle}>너비</span>
        <input
          type="range"
          min={PANEL_WIDTH_MIN}
          max={PANEL_WIDTH_MAX}
          step={10}
          value={settings.panelWidth}
          onChange={handleWidth}
          aria-label="Panel width"
          style={{ flex: 1 }}
        />
        <span style={readoutStyle}>{settings.panelWidth}px</span>
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
        <span style={readoutStyle}>{Math.round(settings.backgroundOpacity * 100)}%</span>
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
            background: sortHover ? 'var(--nav-color-accent-soft)' : 'var(--nav-color-surface-2)',
            borderColor: sortHover ? 'var(--nav-color-accent)' : 'var(--nav-color-border)',
          }}
        >
          {settings.sortOrder === 'asc' ? '↑ 오래된 순' : '↓ 최신 순'}
        </button>
      </div>

      {/* Theme (issue 06) */}
      <div style={rowStyle}>
        <span style={labelStyle}>테마</span>
        <select value={settings.themeMode} onChange={handleTheme} style={{ ...controlStyle, cursor: 'pointer' }}>
          <option value="auto">자동 (Claude 따름)</option>
          <option value="light">라이트</option>
          <option value="dark">다크</option>
        </select>
      </div>
    </div>
  );
}
