// src/shared/types.ts
// MVP scope only. Do NOT add fields not listed here without team agreement.
// Future Work (out of scope): summary, aiSummary, or any LLM-related fields.

export interface ChatboxNode {
  id: string;            // "chatbox-0", "chatbox-1", ... (assigned by tracker.ts)
  index: number;         // DOM order index
  text: string;          // raw prompt text (full)
  hasBranch: boolean;
  branchCurrent: number; // 1-based
  branchTotal: number;   // 1 = no branch
  parentId: string | null;
}

export interface TreeData {
  sessionId: string;          // UUID extracted from /chat/<uuid>
  nodes: ChatboxNode[];
  activeBranchPath: string[]; // node IDs of the currently visible branch
  lastUpdated: number;        // Date.now()
}

export interface UserSettings {
  panelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  panelDirection: 'top-down' | 'left-right';
  backgroundOpacity: number;  // 0.0 – 1.0
  sortOrder: 'asc' | 'desc';
  summaryEnabled: boolean;
  panelVisible: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  panelPosition: 'top-right',
  panelDirection: 'top-down',
  backgroundOpacity: 0.85,
  sortOrder: 'asc',
  summaryEnabled: false, 
  panelVisible: true,
};
