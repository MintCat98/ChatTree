// src/popup/popup-logic.ts
// Pure, framework-free logic for the popup. Extracted so it can be unit-tested
// without rendering React. See tests/unit/popup-logic.test.ts.

import { MessageType } from '@shared/message-types';
import type { BridgeMessage } from '@shared/message-types';
import type { UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

// Supported page = a claude.ai chat conversation URL.
// Strict by design: only /chat/... matches (PR #34 §3; widen later if needed).
export const CLAUDE_CHAT_URL_RE = /^https:\/\/claude\.ai\/chat\//;

export function isSupportedPage(url: string | undefined | null): boolean {
  return !!url && CLAUDE_CHAT_URL_RE.test(url);
}

// Merge stored (possibly partial / older-version) settings over the defaults
// so every field is always present.
export function mergeSettings(
  stored: Partial<UserSettings> | undefined | null,
): UserSettings {
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

// Apply a partial change to the current settings, returning a new object (immutable).
export function applyPatch(
  prev: UserSettings,
  patch: Partial<UserSettings>,
): UserSettings {
  return { ...prev, ...patch };
}

// The SETTINGS_CHANGE message published to the Background SW. Payload is the
// patch only; the Panel merges it on receipt (PR #34 §3).
export function buildSettingsMessage(
  patch: Partial<UserSettings>,
): BridgeMessage<Partial<UserSettings>> {
  return { type: MessageType.SETTINGS_CHANGE, payload: patch };
}
