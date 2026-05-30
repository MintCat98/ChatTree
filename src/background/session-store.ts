// Manages per-tab tree state in chrome.storage.session.
// chrome.storage.session persists across SW restarts within a browser session
// and is automatically cleared when the browser closes.

import type { ChatboxNode, TreeData } from '@shared/types';

function treeKey(tabId: number): string {
  return `tree_${tabId}`;
}

// Strips any DOM element references before storage (e.g., element?: HTMLElement
// that tracker.ts may attach internally — not in the public type, but guarded here).
function serializeNodes(nodes: ChatboxNode[]): ChatboxNode[] {
  return nodes.map((node) => {
    const { ...serialized } = node as ChatboxNode & { element?: unknown };
    delete (serialized as { element?: unknown }).element;
    return serialized as ChatboxNode;
  });
}

export async function getTree(tabId: number): Promise<TreeData | null> {
  const key = treeKey(tabId);
  const result = await chrome.storage.session.get(key);
  return (result[key] as TreeData | undefined) ?? null;
}

export async function updateTree(
  tabId: number,
  nodes: ChatboxNode[],
  sessionId: string,
  activeBranchPath?: string[],
): Promise<TreeData> {
  // Preserve existing activeBranchPath when the caller does not provide one
  let resolvedPath = activeBranchPath;
  if (resolvedPath === undefined) {
    const existing = await getTree(tabId);
    resolvedPath = existing?.activeBranchPath ?? [];
  }

  const tree: TreeData = {
    sessionId,
    nodes: serializeNodes(nodes),
    activeBranchPath: resolvedPath,
    lastUpdated: Date.now(),
  };

  await chrome.storage.session.set({ [treeKey(tabId)]: tree });
  return tree;
}

export async function clearTree(tabId: number): Promise<void> {
  await chrome.storage.session.remove(treeKey(tabId));
}
