// Zustand store for panel UI state (tree data, settings, active/hovered node).
// 이슈 #12 (W4 Skeleton) — 스토어 액션 완전 구현 + settings localStorage 영속화.

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
      // tree는 세션 데이터라 영속화하지 않음 — 페이지 로드마다 DOM에서 재구성
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);
