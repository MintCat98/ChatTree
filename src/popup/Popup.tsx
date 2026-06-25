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
import { DEFAULT_SETTINGS } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';
import { MessageType } from '@shared/message-types';
import { isSupportedPage, mergeSettings, applyPatch } from './popup-logic';
import './popup.css';

// manifest.json version for display. chrome is typed via @types/chrome.
const APP_VERSION = typeof chrome !== 'undefined' ? chrome.runtime.getManifest().version : 'dev';

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
      setSettings(
        mergeSettings(result[STORAGE_KEYS.USER_SETTINGS] as Partial<UserSettings> | undefined)
      );
    });
  }, [status]);

  // 3) Sync popup theme with the panel's resolved theme.
  //    - explicit 'light'/'dark' → apply directly via data-theme attribute
  //    - 'auto' → ask the active tab's content script for the current resolved
  //      theme (the shadow host's data-theme, set by App.tsx via resolveTheme()).
  //      Falls back to OS @media preference when no claude.ai tab is open.
  useEffect(() => {
    const html = document.documentElement;
    if (settings.themeMode !== 'auto') {
      html.dataset.theme = settings.themeMode;
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) { delete html.dataset.theme; return; }
      chrome.tabs.sendMessage(
        tab.id,
        { type: MessageType.GET_RESOLVED_THEME },
        (response: { theme?: string } | undefined) => {
          if (chrome.runtime.lastError || !response?.theme) {
            delete html.dataset.theme; // content script not available → OS fallback
            return;
          }
          html.dataset.theme = response.theme;
        },
      );
    });
  }, [settings.themeMode]);

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
          label="패널 표시"
          checked={settings.panelVisible}
          onChange={(v) => onChange({ panelVisible: v })}
        />
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

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}

function ToggleSwitch({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked ? 'true' : 'false'}
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
