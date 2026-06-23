// Control bar (settings) shown under the header when the Settings button is on.
// Controls: direction (fixed), position, width, opacity, sort, theme. Every change
// is committed via store.updateSettings → persisted to localStorage + mirrored to
// chrome.storage.local (so the popup stays in sync).

import { type ChangeEvent } from 'react';
import { usePanelStore } from '../store/panel-store';
import type { UserSettings } from '@shared/types';
import { PANEL_WIDTH_MIN, PANEL_WIDTH_MAX } from '@shared/types';

export function ControlBar() {
  const settings = usePanelStore((s) => s.settings);
  const updateSettings = usePanelStore((s) => s.updateSettings);

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
    <div data-testid="control-bar" className="nav-control-bar">
      {/* Direction — Top-Down is fixed; Left-Right is reserved for a future PR. */}
      {/*<div className="nav-control-row">
        <span className="nav-control-label">방향</span>
        <select disabled value={settings.panelDirection} className="nav-control" aria-label="패널 방향">
          <option value="top-down">Top-Down</option>
          <option value="left-right">Left-Right (coming soon)</option>
        </select>
      </div>*/}

      {/* Position */}
      <div className="nav-control-row">
        <span className="nav-control-label">위치</span>
        <select
          value={settings.panelPosition}
          onChange={handlePosition}
          className="nav-control"
          aria-label="패널 위치"
        >
          <option value="top-left">좌상단</option>
          <option value="top-right">우상단</option>
          <option value="bottom-left">좌하단</option>
          <option value="bottom-right">우하단</option>
        </select>
      </div>

      {/* Panel width (issue 02) */}
      <div className="nav-control-row">
        <span className="nav-control-label">너비</span>
        <input
          type="range"
          min={PANEL_WIDTH_MIN}
          max={PANEL_WIDTH_MAX}
          step={10}
          value={settings.panelWidth}
          onChange={handleWidth}
          aria-label="Panel width"
          className="nav-range"
        />
        <span className="nav-control-readout">{settings.panelWidth}px</span>
      </div>

      {/* Background opacity */}
      <div className="nav-control-row">
        <span className="nav-control-label">투명도</span>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={settings.backgroundOpacity}
          onChange={handleOpacity}
          aria-label="Background opacity"
          className="nav-range"
        />
        <span className="nav-control-readout">{Math.round(settings.backgroundOpacity * 100)}%</span>
      </div>

      {/* Sort order */}
      <div className="nav-control-row">
        <span className="nav-control-label">정렬</span>
        <button
          type="button"
          onClick={handleSortToggle}
          aria-label={`Current sort: ${settings.sortOrder === 'asc' ? 'ascending' : 'descending'}`}
          className="nav-control nav-control-sort"
        >
          {settings.sortOrder === 'asc' ? '↑ 오래된 순' : '↓ 최신 순'}
        </button>
      </div>

      {/* Theme (issue 06) */}
      <div className="nav-control-row">
        <span className="nav-control-label">테마</span>
        <select
          value={settings.themeMode}
          onChange={handleTheme}
          className="nav-control"
          aria-label="테마"
        >
          <option value="auto">자동 (Claude 따름)</option>
          <option value="light">라이트</option>
          <option value="dark">다크</option>
        </select>
      </div>
    </div>
  );
}
