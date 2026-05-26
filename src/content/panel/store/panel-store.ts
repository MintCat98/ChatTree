// Zustand store for panel UI state (tree data, settings, active node).

import { create } from 'zustand';
import type { TreeData, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

interface PanelStore {
  tree: TreeData | null;
  settings: UserSettings;
  activeNodeId: string | null;
  // TODO: add action signatures (setTree, setSettings, setActiveNode)
}

export const usePanelStore = create<PanelStore>(() => ({
  tree: null,
  settings: DEFAULT_SETTINGS,
  activeNodeId: null,
  // TODO: implement actions
}));
