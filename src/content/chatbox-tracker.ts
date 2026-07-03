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

// One user bubble as found in the current DOM, keyed by its absolute position
// in the conversation (not its position among currently mounted bubbles).
interface MountedBubble {
  absIndex: number;
  top: number | null; // absolute scroll offset of the turn wrapper, if exposed
  text: string;
  branch: BranchInfo;
}

// ---------------------------------------------------------------------------
// virtualization-aware scanning
//
// Claude.ai virtualizes long conversations: turns scrolled far out of view are
// unmounted from the DOM and remount as fresh elements. Two consequences:
//   1. IDs must come from the turn's *absolute* position (data-index /
//      aria-posinset on ancestors), never from DOM enumeration order —
//      otherwise remounted bubbles collide with still-mounted ones.
//   2. A single scan only sees the mounted window, so scans are merged into
//      a per-session cache (mergeMountedNodes) to keep the full tree.
// ---------------------------------------------------------------------------

// Absolute turn position + scroll offset from the virtualized-list ancestors.
// Falls back to null when claude.ai's DOM changes (caller uses DOM order then).
function getAbsolutePosition(el: HTMLElement): { absIndex: number | null; top: number | null } {
  const wrapper = el.closest(SELECTORS.TURN_INDEX_WRAPPER) as HTMLElement | null;
  if (wrapper) {
    const n = parseInt(wrapper.getAttribute('data-index') ?? '', 10);
    if (!isNaN(n)) {
      const top = parseFloat(wrapper.style?.top ?? '');
      return { absIndex: n, top: isNaN(top) ? null : top };
    }
  }

  const article = el.closest(SELECTORS.TURN_ARTICLE) as HTMLElement | null;
  const pos = parseInt(article?.getAttribute('aria-posinset') ?? '', 10);
  if (!isNaN(pos)) return { absIndex: pos - 1, top: null };

  return { absIndex: null, top: null };
}

// Scans currently mounted bubbles and (re)writes their data-nav-id attributes.
function scanMounted(): MountedBubble[] {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return [];

  const bubbles = container.querySelectorAll(SELECTORS.USER_MESSAGE_BUBBLE);
  const mounted: MountedBubble[] = [];

  bubbles.forEach((el, domIndex) => {
    const { absIndex, top } = getAbsolutePosition(el as HTMLElement);
    const idx = absIndex ?? domIndex;

    // Always reassign — a pre-existing data-nav-id may be stale after remount.
    el.setAttribute(SELECTORS.NAV_ID_ATTR, `chatbox-${idx}`);

    mounted.push({
      absIndex: idx,
      top,
      text: el.querySelector(SELECTORS.USER_MESSAGE)?.textContent ?? '',
      branch: detectBranch(el as HTMLElement),
    });
  });

  return mounted;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export function assignChatboxIds(): ChatboxNode[] {
  return scanMounted().map((m, domIndex) => ({
    id: `chatbox-${m.absIndex}`,
    index: domIndex,
    text: m.text,
    hasBranch: m.branch.hasBranch,
    branchCurrent: m.branch.current,
    branchTotal: m.branch.total,
    parentId: null,
  }));
}

// Per-session accumulator: absIndex → last known state of that turn.
// Survives virtualization unmounts; reset on conversation change.
const nodeCache = new Map<number, { node: ChatboxNode; top: number | null }>();

export function resetNodeCache(): void {
  nodeCache.clear();
}

// Cached absolute scroll offset for a node no longer in the DOM
// (scroll-navigator fallback). navId format: "chatbox-<absIndex>".
export function getCachedTop(navId: string): number | null {
  const absIndex = parseInt(navId.replace('chatbox-', ''), 10);
  if (isNaN(absIndex)) return null;
  return nodeCache.get(absIndex)?.top ?? null;
}

/**
 * Merges the currently mounted bubbles into the session cache and returns the
 * full accumulated node list (sequential `index` for display, id from absolute
 * position). If a mounted turn diverges from its cached state (text or branch
 * info changed — i.e. an edit/branch switch rewrote the timeline), all cached
 * turns after it are dropped as stale.
 */
export function mergeMountedNodes(): ChatboxNode[] {
  const mounted = scanMounted().sort((a, b) => a.absIndex - b.absIndex);

  for (const m of mounted) {
    const cached = nodeCache.get(m.absIndex);
    if (
      cached &&
      (cached.node.text !== m.text ||
        cached.node.branchCurrent !== m.branch.current ||
        cached.node.branchTotal !== m.branch.total)
    ) {
      for (const key of [...nodeCache.keys()]) {
        if (key > m.absIndex) nodeCache.delete(key);
      }
    }

    nodeCache.set(m.absIndex, {
      top: m.top,
      node: {
        id: `chatbox-${m.absIndex}`,
        index: 0, // reassigned below
        text: m.text,
        hasBranch: m.branch.hasBranch,
        branchCurrent: m.branch.current,
        branchTotal: m.branch.total,
        parentId: null,
      },
    });
  }

  return [...nodeCache.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, cached], i) => ({ ...cached.node, index: i }));
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

    // Same rule as assignChatboxIds — never trust a pre-existing id.
    const id = `chatbox-${domIndex}`;
    el.setAttribute(SELECTORS.NAV_ID_ATTR, id);

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
