// Extension popup.
// Two views based on the active tab URL:
//   (a) claude.ai chat page → settings form
//   (b) any other page      → "unsupported page" notice
//
// Setting changes flow:
//   onChange → chrome.storage.local.set → chrome.runtime.sendMessage(SETTINGS_CHANGE)
//            → Background SW forwards to the Panel → Panel store.updateSettings()

import { useCallback, useEffect, useState } from 'react';
import { MessageType } from '@shared/message-types';
import type { UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

const CLAUDE_CHAT_URL_RE = /^https:\/\/claude\.ai\/chat\//;

// manifest.json version (optional display). chrome is typed via @types/chrome.
const APP_VERSION =
  typeof chrome !== 'undefined' ? chrome.runtime.getManifest().version : 'dev';

type PageStatus = 'loading' | 'supported' | 'unsupported';

export default function Popup() {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // 1) Detect whether the active tab is a supported page.
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      const supported = !!tab?.url && CLAUDE_CHAT_URL_RE.test(tab.url);
      setStatus(supported ? 'supported' : 'unsupported');
    });
  }, []);

  // 2) Load persisted settings from chrome.storage.local.
  useEffect(() => {
    chrome.storage.local.get(['settings'], (result) => {
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }
    });
  }, []);

  // Apply a partial settings change — persist + notify Panel.
  const apply = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      chrome.storage.local.set({ settings: next });
      chrome.runtime.sendMessage({
        type: MessageType.SETTINGS_CHANGE,
        payload: patch,
      });
      return next;
    });
  }, []);

  return (
    <div
      style={{
        width: 320,
        minHeight: 360,
        padding: 16,
        backgroundColor: '#11111b',
        color: '#f1f5f9',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 13,
        boxSizing: 'border-box',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingBottom: 12,
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Chat Navigator</h1>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>v{APP_VERSION}</span>
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
  return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8' }}>
      Loading…
    </div>
  );
}

function UnsupportedPage() {
  return (
    <div
      style={{
        padding: '32px 16px',
        textAlign: 'center',
        color: '#94a3b8',
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <strong style={{ color: '#f1f5f9' }}>이 페이지는 지원되지 않습니다</strong>
      <p style={{ marginTop: 8 }}>
        <code style={{ color: '#a78bfa' }}>claude.ai</code> 채팅 페이지에서
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
      {/* Panel visibility toggle */}
      <Row label="패널 표시">
        <ToggleSwitch
          checked={settings.panelVisible}
          onChange={(v) => onChange({ panelVisible: v })}
        />
      </Row>

      <Divider />

      {/* Direction — Top-Down is fixed for now. */}
      <Row label="방향">
        <select
          disabled
          value={settings.panelDirection}
          style={selectStyle}
        >
          <option value="top-down">Top-Down</option>
          <option value="left-right">Left-Right (coming soon)</option>
        </select>
      </Row>

      {/* Position */}
      <Row label="위치">
        <select
          value={settings.panelPosition}
          onChange={(e) =>
            onChange({ panelPosition: e.target.value as UserSettings['panelPosition'] })
          }
          style={selectStyle}
        >
          <option value="top-left">좌상단</option>
          <option value="top-right">우상단</option>
          <option value="bottom-left">좌하단</option>
          <option value="bottom-right">우하단</option>
        </select>
      </Row>

      {/* Background opacity */}
      <Row label="배경 투명도">
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 8 }}>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={settings.backgroundOpacity}
            onChange={(e) => onChange({ backgroundOpacity: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span style={{ minWidth: 36, textAlign: 'right' }}>
            {Math.round(settings.backgroundOpacity * 100)}%
          </span>
        </div>
      </Row>

      {/* Sort order */}
      <Row label="정렬">
        <select
          value={settings.sortOrder}
          onChange={(e) => onChange({ sortOrder: e.target.value as UserSettings['sortOrder'] })}
          style={selectStyle}
        >
          <option value="asc">오래된 순</option>
          <option value="desc">최신 순</option>
        </select>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ color: '#94a3b8', minWidth: 80 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return <hr style={{ border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />;
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
      style={{
        width: 44,
        height: 24,
        background: checked ? '#7c3aed' : '#374151',
        borderRadius: 12,
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 150ms',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          background: '#f1f5f9',
          borderRadius: '50%',
          transition: 'left 150ms',
        }}
      />
    </button>
  );
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#f1f5f9',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 13,
};
