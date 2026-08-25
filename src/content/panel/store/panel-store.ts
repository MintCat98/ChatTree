// Zustand store for panel UI state (tree data, settings, active/hovered node).
// Settings are read from chrome.storage.local on mount (App.tsx) and written back
// via updateSettings → mirrorToChromeStorage (issue #05). chrome.storage is the
// single source of truth — no localStorage fallback.

import { create } from 'zustand';
import type { TreeData, UserSettings, NodeMetadata } from '@shared/types';
import type { NodeSummary } from '@shared/summary';
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
  // Per-node summaries for the current session, keyed by nodeId (issue #165).
  // Derived cache, not user data: loaded from the node cache on hydration and
  // refreshed as the summary queue drains. A node with no entry has no summary.
  sessionSummaries: Record<string, NodeSummary>;
  // Tag management state (issue #98) — all transient, not persisted.
  activeTagFilters: string[];      // tag names currently active as filters
  tagPanelOpen:     boolean;       // controls TagPanel visibility
  tagEditNodeId:    string | null; // nodeId whose tag editor popover is open
  // Search state (issue #99) — transient, not persisted.
  searchPanelOpen:  boolean;
  searchQuery:      string;
  // Response generation finished (issue #166) — transient, drives the header
  // message-count blink. Set by the observer, cleared by the Header timer.
  generationComplete: boolean;

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
  setGenerationComplete: (done: boolean) => void;
  // Replace the entire session metadata map (called when tree/session changes).
  setSessionMetadata:   (meta: Record<string, NodeMetadata>) => void;
  // Replace the entire session summary map. Always a full replace: the node
  // cache is the source of truth and a session switch must not leak the
  // previous conversation's summaries onto position-based node IDs.
  setSessionSummaries:  (summaries: Record<string, NodeSummary>) => void;
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
    sessionSummaries:    {},
    activeTagFilters:    [],
    tagPanelOpen:        false,
    tagEditNodeId:       null,
    searchPanelOpen:     false,
    searchQuery:         '',
    generationComplete:  false,

    setTree: (tree) =>
      set((s) => {
        // Highlight fallback: keep the active node only while the incoming
        // tree still contains it. Otherwise (conversation switch — position-
        // based ids are per-conversation — or the node dropped by a branch
        // switch) default to the newest message; the IntersectionObserver
        // overrides as soon as it resolves the actual viewport.
        const nodes = tree?.nodes ?? [];
        const activeStillPresent = nodes.some((n) => n.id === s.activeNodeId);
        return {
          tree,
          activeNodeId: activeStillPresent
            ? s.activeNodeId
            : nodes[nodes.length - 1]?.id ?? null,
          tagEditNodeId: null,
          activeTagFilters: [],
          searchQuery: '',
        };
      }),

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

    setGenerationComplete: (done) => set({ generationComplete: done }),

    setSessionMetadata: (meta) => set({ sessionMetadata: meta }),

    setSessionSummaries: (summaries) => set({ sessionSummaries: summaries }),

    patchNodeMetadata: (nodeId, patch) =>
      set((s) => ({
        sessionMetadata: {
          ...s.sessionMetadata,
          [nodeId]: { ...DEFAULT_NODE_METADATA, ...s.sessionMetadata[nodeId], ...patch },
        },
      })),
  }),
);
