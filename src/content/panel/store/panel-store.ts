// Zustand store for panel UI state (tree data, settings, active node).

import { create } from 'zustand';
import type { TreeData, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

interface PanelStore {
  tree: TreeData | null;
  settings: UserSettings;
  activeNodeId: string | null;
  setTree: (tree: TreeData | null) => void;
  setSettings: (patch: Partial<UserSettings>) => void;
  setActiveNode: (nodeId: string | null) => void;
}

export const usePanelStore = create<PanelStore>((set) => ({
  tree: null,
  settings: DEFAULT_SETTINGS,
  activeNodeId: null,
  setTree: (_tree) => {
    // TODO: implement
    void set;
  },
  setSettings: (_patch) => {
    // TODO: implement
  },
  setActiveNode: (_nodeId) => {
    // TODO: implement
  },
}));
