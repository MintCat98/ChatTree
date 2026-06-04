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
  panelWidth: number;         // px — panel width (resizable). See issue 02.
  themeMode: 'auto' | 'light' | 'dark'; // 'auto' follows the claude.ai theme. See issue 06.
}

// Panel width bounds and default (used by the resize handle and width controls).
export const PANEL_WIDTH_MIN = 240;
export const PANEL_WIDTH_MAX = 520;
export const PANEL_WIDTH_DEFAULT = 280;

export const DEFAULT_SETTINGS: UserSettings = {
  panelPosition: 'top-right',
  panelDirection: 'top-down',
  backgroundOpacity: 0.85,
  sortOrder: 'asc',
  summaryEnabled: false,
  panelVisible: true,
  panelWidth: PANEL_WIDTH_DEFAULT,
  themeMode: 'auto',
};
