// Zustand store for panel UI state (tree data, settings, active/hovered node).
// Implements all actions and persists settings via localStorage (issue #12).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TreeData, UserSettings } from '@shared/types';

const DEFAULT_SETTINGS: UserSettings = {
  panelPosition:     'top-right',
  panelDirection:    'top-down',
  backgroundOpacity: 0.85,
  sortOrder:         'asc',
  summaryEnabled:    false,
  panelVisible:      true,
};

interface PanelState {
  tree:          TreeData | null;
  settings:      UserSettings;
  activeNodeId:  string | null;
  hoveredNodeId: string | null;

  setTree:        (tree: TreeData | null) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  setActiveNode:  (id: string | null) => void;
  setHoveredNode: (id: string | null) => void;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      tree:          null,
      settings:      DEFAULT_SETTINGS,
      activeNodeId:  null,
      hoveredNodeId: null,

      setTree:        (tree)  => set({ tree }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setActiveNode:  (id)    => set({ activeNodeId: id }),
      setHoveredNode: (id)    => set({ hoveredNodeId: id }),
    }),
    {
      name:       'chat-nav-settings',
      storage:    createJSONStorage(() => localStorage),
      // Only `settings` is persisted; `tree` is reconstructed from the DOM on each
      // page load, so persisting it would surface stale data before the observer runs.
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);
