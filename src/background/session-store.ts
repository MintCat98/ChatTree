// Manages per-conversation tree state in chrome.storage.local.
// Keyed by sessionId (conversation UUID) — not tabId — so any tab or window
// opened on the same conversation can hydrate the accumulated tree (issue #152).
// chrome.storage.local survives browser restarts (issue #153); accumulation is
// bounded by the retention policy (periodic purge of stale trees).

import type { ChatboxNode, TreeData } from '@shared/types';

function treeKey(sessionId: string): string {
  return `tree_${sessionId}`;
}

// Strips any DOM element references before storage (e.g., element?: HTMLElement
// that tracker.ts may attach internally — not in the public type, but guarded here).
function serializeNodes(nodes: ChatboxNode[]): ChatboxNode[] {
  return nodes.map((node) => {
    const { element: _omitted, ...serialized } = node as ChatboxNode & { element?: unknown };
    return serialized as ChatboxNode;
  });
}

export async function getTree(sessionId: string): Promise<TreeData | null> {
  const key = treeKey(sessionId);
  const result = await chrome.storage.local.get(key);
  return (result[key] as TreeData | undefined) ?? null;
}

export async function updateTree(
  sessionId: string,
  nodes: ChatboxNode[],
  activeBranchPath?: string[],
): Promise<TreeData> {
  // Preserve existing activeBranchPath when the caller does not provide one
  let resolvedPath = activeBranchPath;
  if (resolvedPath === undefined) {
    const existing = await getTree(sessionId);
    resolvedPath = existing?.activeBranchPath ?? [];
  }

  const tree: TreeData = {
    sessionId,
    nodes: serializeNodes(nodes),
    activeBranchPath: resolvedPath,
    lastUpdated: Date.now(),
  };

  await chrome.storage.local.set({ [treeKey(sessionId)]: tree });
  return tree;
}

export async function clearTree(sessionId: string): Promise<void> {
  await chrome.storage.local.remove(treeKey(sessionId));
}
