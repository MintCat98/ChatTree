// src/shared/types.ts
// MVP scope only. Do NOT add fields not listed here without team agreement.

// ---------------------------------------------------------------------------
// Node Metadata — per-node user data (bookmarks, tags). Issue #96.
// Persisted in chrome.storage.local under STORAGE_KEYS.NODE_METADATA,
// keyed as: NodeMetadataStore[sessionId].nodes[nodeId].
// ---------------------------------------------------------------------------

import type { NodeSummary } from './summary';

export interface NodeMetadata {
  bookmarked: boolean;
  tags: string[];
}

// Per-session envelope: node map + last-touched timestamp used by the orphaned-
// metadata GC (issue #153). v1 stored the node map directly; metadata-storage.ts
// migrates legacy entries on read.
export interface SessionMetadata {
  nodes: Record<string, NodeMetadata>;
  lastUpdated: number;
}

// Full store shape written to chrome.storage.local
export type NodeMetadataStore = Record<string, SessionMetadata>;

export const DEFAULT_NODE_METADATA: NodeMetadata = {
  bookmarked: false,
  tags: [],
};

// Node Summary and Relevance Caching (issue #159). Stored in chrome.storage.local
// under `nodeCache_<sessionId>` as a flat { [nodeId]: NodeCacheEntry } map — see
// node-cache.ts. All fields optional: this is a rebuildable derived cache, not
// user data, so summary (#160) and relevance (#161) can be filled independently.
export interface NodeCacheEntry {
  summary?: NodeSummary;
  relevance?: number;
}

export interface ChatboxNode {
  id: string; // "chatbox-0", "chatbox-1", ... (assigned by tracker.ts)
  index: number; // DOM order index
  text: string; // raw prompt text (full)
  hasBranch: boolean;
  branchCurrent: number; // 1-based
  branchTotal: number; // 1 = no branch
  parentId: string | null;
}

export interface TreeData {
  sessionId: string; // UUID extracted from /chat/<uuid>
  nodes: ChatboxNode[];
  activeBranchPath: string[]; // node IDs of the currently visible branch
  lastUpdated: number; // Date.now()
}

// UI language. 'en' is the default (issue #100). All user-facing strings are
// resolved from src/shared/i18n.ts based on this value.
export type Language = 'en' | 'ko';

export interface UserSettings {
  panelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  backgroundOpacity: number; // 0.0 – 1.0
  sortOrder: 'asc' | 'desc';
  summaryEnabled: boolean;
  panelVisible: boolean;
  panelWidth: number; // px — panel width (resizable). See issue 02.
  themeMode: 'auto' | 'light' | 'dark'; // 'auto' follows the claude.ai theme. See issue 06.
  maxVisibleNodes: number; // maximum number of chat nodes visible on UI
  notifyOnComplete: boolean; // blink the header message count when generation completes. See issue #166.
  language: Language; // UI language. Default 'en'. See issue #100.
  cacheRetentionDays: number; // days before a cached tree is purged from chrome.storage.local (issue #153)
  panelMode: 'popup' | 'sidebar'; // panel display option: docked sidebar provides more "embedded" interface. Default 'popup'
}

// Panel width bounds and default (used by the resize handle and width controls).
export const PANEL_WIDTH_MIN = 240;
export const PANEL_WIDTH_MAX = 520;
export const PANEL_WIDTH_DEFAULT = 280;

// Maximum number of chat nodes default
export const MAX_VISIBLE_NODES = 4;

export const DEFAULT_SETTINGS: UserSettings = {
  panelPosition: 'top-right',
  backgroundOpacity: 0.85,
  sortOrder: 'asc',
  summaryEnabled: false,
  panelVisible: true,
  panelWidth: PANEL_WIDTH_DEFAULT,
  themeMode: 'auto',
  maxVisibleNodes: MAX_VISIBLE_NODES,
  notifyOnComplete: true,
  language: 'en',
  cacheRetentionDays: 30,
  panelMode: 'sidebar',
};
