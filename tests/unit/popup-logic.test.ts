// tests/unit/popup-logic.test.ts
// Unit tests for the popup's pure logic (issue #28, PR #34 review).
// Location: tests/unit/ (matches Jest testMatch). Runs in the node environment.
// Run: `npm test -- popup-logic`

import {
  isSupportedPage,
  mergeSettings,
  applyPatch,
  buildSettingsMessage,
} from '../../src/popup/popup-logic';
import { MessageType } from '@shared/message-types';
import { DEFAULT_SETTINGS } from '@shared/types';

describe('isSupportedPage', () => {
  it('accepts a claude.ai chat URL', () => {
    expect(isSupportedPage('https://claude.ai/chat/abc-123')).toBe(true);
  });
  it('rejects other claude.ai routes', () => {
    expect(isSupportedPage('https://claude.ai/new')).toBe(false);
    expect(isSupportedPage('https://claude.ai/project/x')).toBe(false);
  });
  it('rejects unrelated and empty URLs', () => {
    expect(isSupportedPage('https://example.com')).toBe(false);
    expect(isSupportedPage(undefined)).toBe(false);
    expect(isSupportedPage('')).toBe(false);
  });
  it('rejects non-https claude.ai', () => {
    expect(isSupportedPage('http://claude.ai/chat/x')).toBe(false);
  });
});

describe('mergeSettings', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
  it('overlays a partial stored object onto the defaults', () => {
    const merged = mergeSettings({ panelVisible: false });
    expect(merged.panelVisible).toBe(false);
    expect(merged.panelPosition).toBe(DEFAULT_SETTINGS.panelPosition);
    expect(merged.summaryEnabled).toBe(DEFAULT_SETTINGS.summaryEnabled);
  });
});

describe('applyPatch', () => {
  it('merges the patch without mutating the previous object', () => {
    const prev = { ...DEFAULT_SETTINGS };
    const next = applyPatch(prev, { backgroundOpacity: 0.5 });
    expect(next.backgroundOpacity).toBe(0.5);
    expect(prev.backgroundOpacity).toBe(DEFAULT_SETTINGS.backgroundOpacity); // unchanged
    expect(next.sortOrder).toBe(prev.sortOrder);
  });
});

describe('buildSettingsMessage', () => {
  it('wraps the patch in a SETTINGS_CHANGE message', () => {
    const msg = buildSettingsMessage({ sortOrder: 'desc' });
    expect(msg.type).toBe(MessageType.SETTINGS_CHANGE);
    expect(msg.payload).toEqual({ sortOrder: 'desc' });
  });
});
