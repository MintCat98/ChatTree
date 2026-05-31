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
  //void SELECTORS;
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if(!container) return [];

  const bubbles = container.querySelectorAll(SELECTORS.USER_MESSAGE_BUBBLE);
  const nodes:  ChatboxNode[] = [];

  bubbles.forEach((el, index) => {
    // reuse data-nav-id or provide new id
    let id = el.getAttribute(SELECTORS.NAV_ID_ATTR);
    if (!id) {
      id = `chatbox-${index}`;
      el.setAttribute(SELECTORS.NAV_ID_ATTR, id);
    }

    // extract text
    const text = el.querySelector(SELECTORS.USER_MESSAGE)?.textContent ?? '';

    // branch info
    const { hasBranch, current, total } = detectBranch(el as HTMLElement);

    nodes.push({
      id,
      index,
      text,
      hasBranch,
      branchCurrent: current,
      branchTotal: total,
      parentId: null,
    });
  });

  return nodes;
}

// Search branches using Element input
export function detectBranch(el: HTMLElement): BranchInfo {
  const wrapper = el.parentElement?.querySelector(SELECTORS.BRANCH_ACTIONS_WRAPPER);
  if (!wrapper) return { hasBranch: false, current: 1, total: 1 };

  // BRANCH_INDICATOR includes text like "[current branch #]/[Total # of branch]"
  const indicator = wrapper.querySelector(SELECTORS.BRANCH_INDICATOR);
  const text = indicator?.textContent ?? ''; 
  const [n, m] = text.split('/').map(Number);

  // There won't be any texts if this chat has single branch
  if (!n || !m) return { hasBranch: true, current: 1, total: 1 };

  return { hasBranch: true, current: n, total: m };
}

/**
 * Transforms flat ChatboxNode array into TreeData structure
 * then connects Branch point's parentId chains
 */
export function buildTree(_nodes: ChatboxNode[]): TreeData {
  // Extract sessionId
  const match = location.href.match(/\/chat\/([a-f0-9-]{36})/);
  const sessionId = match ? match[1] : 'unknown';

  // decide parentId
  let lastBranchPointId: string | null = null;
  let prevNodeId: string | null = null;

  const linked = _nodes.map((node) => {
    let parentId: string | null;

    if (node.hasBranch) {
      parentId = lastBranchPointId;
      lastBranchPointId = node.id;
    } else{
      parentId = prevNodeId;
    }

    prevNodeId = node.id;
    return {...node, parentId};
  });

  return {
    sessionId,
    nodes: linked,
    activeBranchPath: linked.map((node)=>node.id),
    lastUpdated:Date.now(),
  }
}

/**
 * Preserves nodes up to and including the branch point, then re-scans the DOM
 * from branchIndex+1 onward. Falls back to a full assignChatboxIds() if the
 * branch node is not found in the current node list (e.g. stale state after reload).
 */
export function reloadFromNode(branchNodeId: string, allNodes: ChatboxNode[]): ChatboxNode[] {
  const branchIndex = allNodes.findIndex(n => n.id === branchNodeId);
  if (branchIndex === -1) return assignChatboxIds();

  const preserved = allNodes.slice(0, branchIndex + 1);

  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return preserved;

  const bubbles = container.querySelectorAll(SELECTORS.USER_MESSAGE_BUBBLE);

  // Caller must guarantee currentNodes reflects current DOM ordering.
  // If DOM has fewer bubbles than expected, currentNodes is stale — full rescan.
  if (bubbles.length <= branchIndex) return assignChatboxIds();
  const newNodes: ChatboxNode[] = [];

  bubbles.forEach((el, domIndex) => {
    if (domIndex <= branchIndex) return;

    let id = el.getAttribute(SELECTORS.NAV_ID_ATTR);
    if (!id) {
      id = `chatbox-${domIndex}`;
      el.setAttribute(SELECTORS.NAV_ID_ATTR, id);
    }

    const text = el.querySelector(SELECTORS.USER_MESSAGE)?.textContent ?? '';
    const { hasBranch, current, total } = detectBranch(el as HTMLElement);

    newNodes.push({
      id,
      index: domIndex,
      text,
      hasBranch,
      branchCurrent: current,
      branchTotal: total,
      parentId: null, // buildTree will reassign all parentId chains
    });
  });

  return [...preserved, ...newNodes];
}
