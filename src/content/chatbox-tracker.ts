// src/content/chatbox-tracker.ts

import { SELECTORS } from '@shared/constants';
import type { ChatboxNode, TreeData } from '@shared/types';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface BranchInfo {
  hasBranch: boolean;
  current: number;
  total: number;
}

// ---------------------------------------------------------------------------
// 퍼블릭 API — stub
// ---------------------------------------------------------------------------
export function assignChatboxIds(): ChatboxNode[] {
  void SELECTORS;
  return [];
}

// 유저 메세지의 Element를 기반으로 Branch를 탐색하는 함수
export function detectBranch(_el: HTMLElement): BranchInfo {
  return { hasBranch: false, current: 1, total: 1 };
}

/**
 * 평탄한 ChatboxNode 배열을 TreeData 구조로 변환하고
 * 브랜치 포인트의 parentId 체인을 연결합니다.
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
 * 브랜치 포인트까지의 노드를 보존하고, 그 이후부터 DOM을 재스캔합니다.
 */
export function reloadFromNode(
  _branchNodeId: string,
  allNodes: ChatboxNode[],
): ChatboxNode[] {
  return allNodes;
}