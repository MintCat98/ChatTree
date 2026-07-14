// Control bar (settings) shown under the header when the Settings button is on.
// Controls: position, width, opacity, sort, theme, visible nodes, language, reset.
// Every change is committed via store.updateSettings → persisted to localStorage +
// mirrored to chrome.storage.local (so the popup stays in sync).

import { type ChangeEvent } from 'react';
import { usePanelStore } from '../store/panel-store';
import { useMessages } from '../i18n';
import type { UserSettings } from '@shared/types';
import { PANEL_WIDTH_MIN, PANEL_WIDTH_MAX, MAX_VISIBLE_NODES, DEFAULT_SETTINGS } from '@shared/types';

export function ControlBar() {
  const t = useMessages();
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
  const handleMaxVisibleNodes = (e: ChangeEvent<HTMLInputElement>) =>
    updateSettings({ maxVisibleNodes: Number(e.target.value) });
  const handleLanguage = (e: ChangeEvent<HTMLSelectElement>) =>
    updateSettings({ language: e.target.value as UserSettings['language'] });
  const handleNotifyToggle = () =>
    updateSettings({ notifyOnComplete: !settings.notifyOnComplete });
  const handlePanelMode = (e: ChangeEvent<HTMLSelectElement>) =>
    updateSettings({ panelMode: e.target.value as UserSettings['panelMode'] });
  const handleReset = () => updateSettings(DEFAULT_SETTINGS);

  return (
    <div data-testid="control-bar" className="nav-control-bar">
      {/* Panel mode */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.panelMode}</span>
        <select
          value={settings.panelMode}
          onChange={handlePanelMode}
          className="nav-control"
          aria-label={t.panelModeAria}
        >
          <option value="popup">{t.panelModePopup}</option>
          <option value="sidebar">{t.panelModeSidebar}</option>
        </select>
      </div>
      {/* Position */}
      {settings.panelMode === 'popup' && (
        <div className="nav-control-row">
          <span className="nav-control-label">{t.position}</span>
          <select
            value={settings.panelPosition}
            onChange={handlePosition}
            className="nav-control"
            aria-label={t.positionAria}
          >
            <option value="top-left">{t.posTopLeft}</option>
            <option value="top-right">{t.posTopRight}</option>
            <option value="bottom-left">{t.posBottomLeft}</option>
            <option value="bottom-right">{t.posBottomRight}</option>
          </select>
        </div>
      )}
      

      {/* Panel width (issue 02) */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.width}</span>
        <input
          type="range"
          min={PANEL_WIDTH_MIN}
          max={PANEL_WIDTH_MAX}
          step={10}
          value={settings.panelWidth}
          onChange={handleWidth}
          aria-label={t.widthAria}
          className="nav-range"
        />
        <span className="nav-control-readout">{settings.panelWidth}px</span>
      </div>

      {/* Background opacity */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.opacity}</span>
        <input
          type="range"
          min={0.3}
          max={1}
          step={0.05}
          value={settings.backgroundOpacity}
          onChange={handleOpacity}
          aria-label={t.opacityAria}
          className="nav-range"
        />
        <span className="nav-control-readout">{Math.round(settings.backgroundOpacity * 100)}%</span>
      </div>

      {/* Sort order */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.sort}</span>
        <button
          type="button"
          onClick={handleSortToggle}
          aria-label={t.sortAria(settings.sortOrder)}
          className="nav-control nav-control-sort"
        >
          {settings.sortOrder === 'asc' ? t.sortAscLabel : t.sortDescLabel}
        </button>
      </div>

      {/* Theme (issue 06) */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.theme}</span>
        <select
          value={settings.themeMode}
          onChange={handleTheme}
          className="nav-control"
          aria-label={t.themeAria}
        >
          <option value="auto">{t.themeAuto}</option>
          <option value="light">{t.themeLight}</option>
          <option value="dark">{t.themeDark}</option>
        </select>
      </div>

      {/* Max visible nodes */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.maxNodes}</span>
        <input
          type="range"
          min={2}
          max={MAX_VISIBLE_NODES * 2}
          step={1}
          value={settings.maxVisibleNodes}
          onChange={handleMaxVisibleNodes}
          aria-label={t.maxNodesAria}
          className="nav-range"
        />
        <span className="nav-control-readout">{settings.maxVisibleNodes}</span>
      </div>

      {/* Generation-complete notification (issue #166) */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.notifyComplete}</span>
        <button
          type="button"
          onClick={handleNotifyToggle}
          aria-label={t.notifyCompleteAria}
          aria-pressed={settings.notifyOnComplete}
          className="nav-control nav-control-sort"
        >
          {settings.notifyOnComplete ? t.notifyOnLabel : t.notifyOffLabel}
        </button>
      </div>

      {/* Language (issue #100) */}
      <div className="nav-control-row">
        <span className="nav-control-label">{t.language}</span>
        <select
          value={settings.language}
          onChange={handleLanguage}
          className="nav-control"
          aria-label={t.languageAria}
        >
          <option value="en">{t.langEnglish}</option>
          <option value="ko">{t.langKorean}</option>
        </select>
      </div>

      {/* Reset to Default*/}
      <div className="nav-control-row">
        <button
          type="button"
          onClick={handleReset}
          className="nav-control"
          aria-label={t.resetAria}
        >
          {t.resetDefaults}
        </button>
      </div>
    </div>
  );
}
