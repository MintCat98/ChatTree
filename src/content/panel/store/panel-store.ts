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
  // Per-node metadata for the current session, keyed by nodeId (issue #96).
  // Loaded from chrome.storage.local when the tree is hydrated.
  sessionMetadata:  Record<string, NodeMetadata>;

  setTree:              (tree: TreeData | null) => void;
  updateSettings:       (patch: Partial<UserSettings>) => void;
  // Update settings WITHOUT writing back to chrome.storage. Used for incoming
  // storage-change hydration (avoids a write loop) and for live drag-resize.
  hydrateSettings:      (patch: Partial<UserSettings>) => void;
  setActiveNode:        (id: string | null) => void;
  setHoveredNode:       (id: string | null) => void;
  setHoverPos:          (pos: HoverPos | null) => void;
  toggleCollapsed:      () => void;
  toggleSettingsOpen:   () => void;
  // Replace the entire session metadata map (called when tree/session changes).
  setSessionMetadata:   (meta: Record<string, NodeMetadata>) => void;
  // Optimistic local update for a single node (caller writes to chrome.storage).
  patchNodeMetadata:    (nodeId: string, patch: Partial<NodeMetadata>) => void;
}

export const usePanelStore = create<PanelState>()(
  (set) => ({
    tree:            null,
    settings:        DEFAULT_SETTINGS,
    activeNodeId:    null,
    hoveredNodeId:   null,
    hoverPos:        null,
    collapsed:       false,
    settingsOpen:    false,
    sessionMetadata: {},

    setTree: (tree) => set({ tree }),

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

    toggleCollapsed:    () => set((s) => ({ collapsed: !s.collapsed })),
    toggleSettingsOpen: () => set((s) => ({ settingsOpen: !s.settingsOpen })),

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
