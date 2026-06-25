// Zustand store for panel UI state (tree data, settings, active/hovered node).
// Settings are read from chrome.storage.local on mount (App.tsx) and written back
// via updateSettings → mirrorToChromeStorage (issue #05). chrome.storage is the
// single source of truth — no localStorage fallback.

import { create } from 'zustand';
import type { TreeData, UserSettings, NodeMetadata } from '@shared/types';
import { DEFAULT_SETTINGS, DEFAULT_NODE_METADATA } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

// Cursor position used to anchor the hover tooltip. Stored here because the
// nodes live inside a closed Shadow DOM and can't be located from document.
interface HoverPos {
  x: number;
  y: number;
}

// Mirror the full settings object to chrome.storage.local. Guarded so unit tests
// (jsdom, no `chrome` global) and any non-extension context don't throw.
function mirrorToChromeStorage(settings: UserSettings): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.set({ [STORAGE_KEYS.USER_SETTINGS]: settings });
}

interface PanelState {
  tree:             TreeData | null;
  settings:         UserSettings;
  activeNodeId:     string | null;
  hoveredNodeId:    string | null;
  hoverPos:         HoverPos | null;
  collapsed:        boolean;   // header-only minimized view (issue 03)
  settingsOpen:     boolean;   // controls ControlBar visibility (issue 04)
  bookmarksOnlyFilter: boolean; // transient view filter — not persisted
  // Per-node metadata for the current session, keyed by nodeId (issue #96).
  // Loaded from chrome.storage.local when the tree is hydrated.
  sessionMetadata:  Record<string, NodeMetadata>;
  // Tag management state (issue #98) — all transient, not persisted.
  activeTagFilters: string[];      // tag names currently active as filters
  tagPanelOpen:     boolean;       // controls TagPanel visibility
  tagEditNodeId:    string | null; // nodeId whose tag editor popover is open
  // Search state (issue #99) — transient, not persisted.
  searchPanelOpen:  boolean;
  searchQuery:      string;

  setTree:              (tree: TreeData | null) => void;
  updateSettings:       (patch: Partial<UserSettings>) => void;
  // Update settings WITHOUT writing back to chrome.storage. Used for incoming
  // storage-change hydration (avoids a write loop) and for live drag-resize.
  hydrateSettings:      (patch: Partial<UserSettings>) => void;
  setActiveNode:        (id: string | null) => void;
  setHoveredNode:       (id: string | null) => void;
  setHoverPos:          (pos: HoverPos | null) => void;
  toggleCollapsed:             () => void;
  toggleSettingsOpen:          () => void;
  toggleBookmarksOnlyFilter:   () => void;
  toggleTagFilter:    (tag: string) => void;
  clearTagFilters:    () => void;
  toggleTagPanel:     () => void;
  setTagEditNodeId:   (id: string | null) => void;
  toggleSearchPanel:  () => void;
  setSearchQuery:     (query: string) => void;
  // Replace the entire session metadata map (called when tree/session changes).
  setSessionMetadata:   (meta: Record<string, NodeMetadata>) => void;
  // Optimistic local update for a single node (caller writes to chrome.storage).
  patchNodeMetadata:    (nodeId: string, patch: Partial<NodeMetadata>) => void;
}

export const usePanelStore = create<PanelState>()(
  (set) => ({
    tree:                null,
    settings:            DEFAULT_SETTINGS,
    activeNodeId:        null,
    hoveredNodeId:       null,
    hoverPos:            null,
    collapsed:           false,
    settingsOpen:        false,
    bookmarksOnlyFilter: false,
    sessionMetadata:     {},
    activeTagFilters:    [],
    tagPanelOpen:        false,
    tagEditNodeId:       null,
    searchPanelOpen:     false,
    searchQuery:         '',

    setTree: (tree) => set({ tree, tagEditNodeId: null, activeTagFilters: [], searchQuery: '' }),

    updateSettings: (patch) =>
      set((s) => {
        const next = { ...s.settings, ...patch };
        mirrorToChromeStorage(next);
        return { settings: next };
      }),

    hydrateSettings: (patch) =>
      set((s) => ({ settings: { ...s.settings, ...patch } })),

    setActiveNode:  (id)  => set({ activeNodeId: id }),
    setHoveredNode: (id)  => set({ hoveredNodeId: id }),
    setHoverPos:    (pos) => set({ hoverPos: pos }),

    toggleCollapsed:           () => set((s) => ({ collapsed: !s.collapsed })),
    toggleSettingsOpen: () =>
      set((s) => {
        const opening = !s.settingsOpen;
        return opening
          ? { settingsOpen: true, tagPanelOpen: false, searchPanelOpen: false }
          : { settingsOpen: false };
      }),
    toggleBookmarksOnlyFilter: () => set((s) => ({ bookmarksOnlyFilter: !s.bookmarksOnlyFilter })),

    toggleTagFilter: (tag) =>
      set((s) => ({
        activeTagFilters: s.activeTagFilters.includes(tag)
          ? s.activeTagFilters.filter((t) => t !== tag)
          : [...s.activeTagFilters, tag],
      })),
    clearTagFilters:  () => set({ activeTagFilters: [] }),
    toggleTagPanel: () =>
      set((s) => {
        const opening = !s.tagPanelOpen;
        return opening
          ? { tagPanelOpen: true, settingsOpen: false }
          : { tagPanelOpen: false };
      }),
    setTagEditNodeId: (id) => set({ tagEditNodeId: id }),
    toggleSearchPanel: () =>
      set((s) => {
        const opening = !s.searchPanelOpen;
        return opening
          ? { searchPanelOpen: true, settingsOpen: false }
          : { searchPanelOpen: false };
      }),
    setSearchQuery:    (query) => set({ searchQuery: query }),

    setSessionMetadata: (meta) => set({ sessionMetadata: meta }),

    patchNodeMetadata: (nodeId, patch) =>
      set((s) => ({
        sessionMetadata: {
          ...s.sessionMetadata,
          [nodeId]: { ...DEFAULT_NODE_METADATA, ...s.sessionMetadata[nodeId], ...patch },
        },
      })),
  }),
);
