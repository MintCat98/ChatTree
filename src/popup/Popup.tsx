// src/popup/Popup.tsx
// Extension popup entry. Two views based on the active tab URL:
//   (a) claude.ai chat page -> settings form
//   (b) any other page      -> "unsupported page" notice
//
// Settings are the single source of truth in chrome.storage.local under
// STORAGE_KEYS.USER_SETTINGS. The content panel hydrates + live-subscribes to
// chrome.storage.onChanged, so writing here reflects in the panel instantly
// (issue 05). Pure logic (URL match, settings merge) lives in ./popup-logic.

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import type { UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS, PANEL_WIDTH_MIN, PANEL_WIDTH_MAX } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';
import { isSupportedPage, mergeSettings, applyPatch } from './popup-logic';
import './popup.css';

// manifest.json version for display. chrome is typed via @types/chrome.
const APP_VERSION =
  typeof chrome !== 'undefined' ? chrome.runtime.getManifest().version : 'dev';

type PageStatus = 'loading' | 'supported' | 'unsupported';

export function Popup() {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // 1) Detect whether the active tab is a supported page.
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      setStatus(isSupportedPage(tab?.url) ? 'supported' : 'unsupported');
    });
  }, []);

  // 2) Load persisted settings only once the page is confirmed supported,
  //    so storage is never touched on unsupported pages. (review #4)
  useEffect(() => {
    if (status !== 'supported') return;
    chrome.storage.local.get(STORAGE_KEYS.USER_SETTINGS, (result) => {
      setSettings(mergeSettings(result[STORAGE_KEYS.USER_SETTINGS] as Partial<UserSettings> | undefined));
    });
  }, [status]);

  // Apply a partial change: persist the FULL merged settings to chrome.storage.local.
  // The panel picks it up via chrome.storage.onChanged — no extra messaging needed.
  const apply = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = applyPatch(prev, patch);
      chrome.storage.local.set({ [STORAGE_KEYS.USER_SETTINGS]: next });
      return next;
    });
  }, []);

  return (
    <div className="cn-popup">
      <header className="cn-header">
        <h1 className="cn-title">ChatTree</h1>
        <span className="cn-version">v{APP_VERSION}</span>
      </header>

      {status === 'loading' ? (
        <Loading />
      ) : status === 'unsupported' ? (
        <UnsupportedPage />
      ) : (
        <SettingsForm settings={settings} onChange={apply} />
      )}
    </div>
  );
}

function Loading() {
  return <div className="cn-loading">Loading…</div>;
}

function UnsupportedPage() {
  return (
    <div className="cn-unsupported">
      <div className="cn-unsupported__icon">⚠️</div>
      <strong className="cn-unsupported__title">이 페이지는 지원되지 않습니다</strong>
      <p>
        <code>claude.ai</code> 채팅 페이지에서
        <br />
        익스텐션을 사용하세요.
      </p>
    </div>
  );
}

interface SettingsFormProps {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
}

function SettingsForm({ settings, onChange }: SettingsFormProps) {
  return (
    <div className="cn-form">
      {/* Panel visibility toggle */}
      <Row label="패널 표시">
        <ToggleSwitch
          checked={settings.panelVisible}
          onChange={(v) => onChange({ panelVisible: v })}
        />
      </Row>

      <Divider />

      {/* Direction: Top-Down is fixed for now (tracked separately) */}
      <Row label="방향">
        <select className="cn-select" disabled value={settings.panelDirection}>
          <option value="top-down">Top-Down</option>
          <option value="left-right">Left-Right (coming soon)</option>
        </select>
      </Row>

      {/* Position */}
      <Row label="위치">
        <select
          className="cn-select"
          value={settings.panelPosition}
          onChange={(e) =>
            onChange({ panelPosition: e.target.value as UserSettings['panelPosition'] })
          }
        >
          <option value="top-left">좌상단</option>
          <option value="top-right">우상단</option>
          <option value="bottom-left">좌하단</option>
          <option value="bottom-right">우하단</option>
        </select>
      </Row>

      {/* Panel width (issue 02) */}
      <Row label="너비">
        <div className="cn-opacity">
          <input
            className="cn-opacity__range"
            type="range"
            min={PANEL_WIDTH_MIN}
            max={PANEL_WIDTH_MAX}
            step={10}
            value={settings.panelWidth}
            onChange={(e) => onChange({ panelWidth: Number(e.target.value) })}
          />
          <span className="cn-opacity__value">{settings.panelWidth}px</span>
        </div>
      </Row>

      {/* Background opacity */}
      <Row label="배경 투명도">
        <div className="cn-opacity">
          <input
            className="cn-opacity__range"
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={settings.backgroundOpacity}
            onChange={(e) => onChange({ backgroundOpacity: Number(e.target.value) })}
          />
          <span className="cn-opacity__value">
            {Math.round(settings.backgroundOpacity * 100)}%
          </span>
        </div>
      </Row>

      {/* Sort order */}
      <Row label="정렬">
        <select
          className="cn-select"
          value={settings.sortOrder}
          onChange={(e) => onChange({ sortOrder: e.target.value as UserSettings['sortOrder'] })}
        >
          <option value="asc">오래된 순</option>
          <option value="desc">최신 순</option>
        </select>
      </Row>

      {/* Theme (issue 06) */}
      <Row label="테마">
        <select
          className="cn-select"
          value={settings.themeMode}
          onChange={(e) => onChange({ themeMode: e.target.value as UserSettings['themeMode'] })}
        >
          <option value="auto">자동 (Claude 따름)</option>
          <option value="light">라이트</option>
          <option value="dark">다크</option>
        </select>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="cn-row">
      <span className="cn-row__label">{label}</span>
      <div className="cn-row__control">{children}</div>
    </div>
  );
}

function Divider() {
  return <hr className="cn-divider" />;
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleSwitch({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={checked ? 'cn-toggle cn-toggle--on' : 'cn-toggle'}
    >
      <span className={checked ? 'cn-toggle__knob cn-toggle__knob--on' : 'cn-toggle__knob'} />
    </button>
  );
}

// Mount into popup.html's #root. (Popup.tsx is the webpack `popup` entry, so it self-mounts.)
const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(<Popup />);
}
