// src/content/chatbox-tracker.ts

import { SELECTORS } from '@shared/constants';
import type { ChatboxNode, TreeData } from '@shared/types';

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface BranchInfo {
  hasBranch: boolean;
  current: number;
  total: number;
}

// ---------------------------------------------------------------------------
// public API — stub
// ---------------------------------------------------------------------------
export function assignChatboxIds(): ChatboxNode[] {
  void SELECTORS;
  return [];
}

// Search branches using Element input
export function detectBranch(_el: HTMLElement): BranchInfo {
  return { hasBranch: false, current: 1, total: 1 };
}

/**
 * Transforms flat ChatboxNode array into TreeData structure
 * then connects Branch point's parentId chains
 */
export function buildTree(_nodes: ChatboxNode[]): TreeData {
  return {
    sessionId: 'unknown',
    nodes: [],
    activeBranchPath: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Re-scans the DOM from the given branch point node onward.
 */
export function reloadFromNode(
  _branchNodeId: string,
  allNodes: ChatboxNode[],
): ChatboxNode[] {
  return allNodes;
}
