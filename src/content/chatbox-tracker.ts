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
  setsize: number | null; // total turn count from the turn's own article, if exposed
  text: string;
  branch: BranchInfo;
  answer: string | null; // AI response text, if mounted and not streaming
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

// Total turn count exposed by the virtualized list on the turn's own
// [role="article"] ancestor. Read per bubble, never document-wide: during an
// SPA swap the first article in the document can belong to the previous
// conversation's stale frame, and its setsize would prune this one's tail.
function getArticleSetsize(el: HTMLElement): number | null {
  const article = el.closest(SELECTORS.TURN_ARTICLE) as HTMLElement | null;
  const setsize = parseInt(article?.getAttribute('aria-setsize') ?? '', 10);
  return isNaN(setsize) || setsize <= 0 ? null : setsize;
}

// Scans currently mounted bubbles and (re)writes their data-nav-id attributes.
function scanMounted(): MountedBubble[] {
  const container = document.querySelector(SELECTORS.CHAT_CONTAINER);
  if (!container) return [];

  // Skip the stale-nav frame (issue #176): its turns belong to the previous
  // conversation. Answers are filtered too — pairing below is by index, so a
  // foreign answer would shift every bubble's answer.
  const isLive = (el: Element): boolean => !el.closest(SELECTORS.INERT_FRAME);
  const bubbles = [...container.querySelectorAll(SELECTORS.USER_MESSAGE_BUBBLE)].filter(isLive);
  const mounted: MountedBubble[] = [];
  const answers = [...container.querySelectorAll(SELECTORS.CLAUDE_RESPONSE)].filter(isLive);
  const answerTexts = answers.map((el) => {
    // Skip streaming responses
    if (el.closest(`[${SELECTORS.STREAMING_ATTR}="true"]`)) return null;

    return [...el.querySelectorAll(SELECTORS.RESPONSE_MARKDOWN)]
      .map((m) => m.textContent?.trim() ?? null)
      .filter(Boolean)
      .join('\n\n');
  });

  bubbles.forEach((el, domIndex) => {
    const { absIndex, top } = getAbsolutePosition(el as HTMLElement);
    const idx = absIndex ?? domIndex;

    // Always reassign — a pre-existing data-nav-id may be stale after remount.
    el.setAttribute(SELECTORS.NAV_ID_ATTR, `chatbox-${idx}`);

    mounted.push({
      absIndex: idx,
      top,
      setsize: getArticleSetsize(el as HTMLElement),
      text: el.querySelector(SELECTORS.USER_MESSAGE)?.textContent ?? '',
      branch: detectBranch(el as HTMLElement),
      answer: answerTexts[domIndex] ?? null,
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
const nodeCache = new Map<number, { node: ChatboxNode; top: number | null; answer: string | null }>();

export function resetNodeCache(): void {
  nodeCache.clear();
}

// navId format: "chatbox-<absIndex>" — recover the absolute turn index.
export function absIndexFromNavId(navId: string): number | null {
  const n = parseInt(navId.replace('chatbox-', ''), 10);
  return isNaN(n) ? null : n;
}

// Cached absolute scroll offset for a node no longer in the DOM
// (scroll-navigator fallback).
export function getCachedTop(navId: string): number | null {
  const absIndex = absIndexFromNavId(navId);
  if (absIndex === null) return null;
  return nodeCache.get(absIndex)?.top ?? null;
}

// Fetch cached answer by navId (pipeline #160)
export function getCachedAnswer(navId: string): string | null {
  const absIndex = absIndexFromNavId(navId);
  if (absIndex === null) return null;
  return nodeCache.get(absIndex)?.answer ?? null;
}

/**
 * Seeds the cache from a tree persisted in chrome.storage.local (issues #152, #153)
 * so the full accumulated tree survives new windows / tab reloads / browser restarts. Optimistic:
 * DOM-scanned entries always win (existing absIndices are never overwritten),
 * and stale seeded turns are dropped by mergeMountedNodes' divergence rule as
 * the live DOM is scanned.
 */
export function seedNodeCache(nodes: ChatboxNode[]): void {
  for (const node of nodes) {
    const absIndex = absIndexFromNavId(node.id);
    if (absIndex === null || nodeCache.has(absIndex)) continue;
    // top: null — offsets come from the live DOM only; scroll-navigator
    // falls back to a proportional estimate for seeded nodes.
    nodeCache.set(absIndex, { top: null, node: { ...node, parentId: null }, answer: null });
  }
}

// Turn count of the conversation the scanned bubbles belong to. Null when
// nothing is mounted or the DOM does not expose it — in both cases there is
// no trustworthy bound to prune against.
function getTurnSetsize(mounted: MountedBubble[]): number | null {
  return mounted.find((m) => m.setsize !== null)?.setsize ?? null;
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

  // Cached turns at indices the conversation cannot contain are contamination:
  // a scan that spanned an SPA transition and caught the previous
  // conversation's still-mounted turns, or a tail from a longer branch. The
  // divergence rule below never catches them (their indices never mount in a
  // shorter conversation), so prune against the DOM's own turn count.
  const setsize = getTurnSetsize(mounted);
  if (setsize !== null) {
    for (const key of [...nodeCache.keys()]) {
      if (key >= setsize) nodeCache.delete(key);
    }
  }

  for (const m of mounted) {
    const cached = nodeCache.get(m.absIndex);

    // An unreadable state is not a change — treating it as one drops every
    // turn after it. An empty user-message means edit mode or mid-render
    // (an attachment-only turn is empty too and simply never text-diverges).
    // A "1 / 1" read while N > 1 is cached is detectBranch's no-indicator
    // default (hover-only actions bar, class drift): claude.ai never
    // collapses branches back to one, so keep the cached branch state.
    const text = m.text || cached?.node.text || '';
    const branchUnreadable =
      cached !== undefined &&
      cached.node.branchTotal > 1 &&
      m.branch.total === 1 &&
      m.branch.current === 1;
    const branch: BranchInfo = branchUnreadable
      ? {
          hasBranch: cached.node.hasBranch,
          current: cached.node.branchCurrent,
          total: cached.node.branchTotal,
        }
      : m.branch;

    if (
      cached &&
      ((cached.node.text !== '' && m.text !== '' && cached.node.text !== m.text) ||
        cached.node.branchCurrent !== branch.current ||
        cached.node.branchTotal !== branch.total)
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
        text,
        hasBranch: branch.hasBranch,
        branchCurrent: branch.current,
        branchTotal: branch.total,
        parentId: null,
      },
      answer: m.answer ?? cached?.answer ?? null,
    });
  }

  return cachedNodeList();
}

// ---------------------------------------------------------------------------
// post-navigation DOM trust (observer.ts domTrusted)
//
// After an SPA navigation the previous conversation's stale frame keeps
// mutating under <main>, so a childList change alone does not prove the new
// conversation rendered. Two signals do.
// ---------------------------------------------------------------------------

// A user bubble of the live conversation mounted in this mutation batch.
export function mutationsMountTurn(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    for (const node of Array.from(mutation.addedNodes)) {
      if (node.nodeType !== 1) continue; // Node.ELEMENT_NODE
      const el = node as Element;
      if (el.closest(SELECTORS.INERT_FRAME)) continue;
      if (el.matches(SELECTORS.USER_MESSAGE_BUBBLE) || el.querySelector(SELECTORS.USER_MESSAGE_BUBBLE)) {
        return true;
      }
    }
  }
  return false;
}

// Nothing mounted contradicts the cache: every mounted bubble whose absolute
// index is cached carries the same text (empty reads are inconclusive, not
// contradictions). Vacuously true with an empty cache or nothing mounted —
// there is nothing hydrated to destroy, so trusting the DOM is harmless.
// Only meaningful once hydration settled; before that the cache is empty.
export function mountedDomMatchesCache(): boolean {
  return scanMounted().every((m) => {
    const cached = nodeCache.get(m.absIndex);
    return !cached || !cached.node.text || !m.text || cached.node.text === m.text;
  });
}

// Cache contents as a display list, WITHOUT scanning the DOM. Used right after
// an SPA navigation while the previous conversation's DOM may still be mounted
// — scanning it would merge foreign turns and prune against a foreign
// aria-setsize, destroying the hydrated cache.
export function getCachedNodes(): ChatboxNode[] {
  return cachedNodeList();
}

function cachedNodeList(): ChatboxNode[] {
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
