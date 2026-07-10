// Manages per-conversation tree state in chrome.storage.local.
// Keyed by sessionId (conversation UUID) — not tabId — so any tab or window
// opened on the same conversation can hydrate the accumulated tree (issue #152).
// chrome.storage.local survives browser restarts (issue #153); accumulation is
// bounded by the retention policy (periodic purge of stale trees).

import type { ChatboxNode, TreeData, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

const TREE_KEY_PREFIX = 'tree_';

function treeKey(sessionId: string): string {
  return `${TREE_KEY_PREFIX}${sessionId}`;
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

  try {
    await chrome.storage.local.set({ [treeKey(sessionId)]: tree });
  } catch {
    // Quota safety net (issue #153): storage.local is capped at 10 MB. Evict
    // the oldest cached trees and retry once; on repeated failure the panel
    // keeps working from the in-memory tree — only the cache entry is stale.
    await evictOldestTrees(sessionId);
    try {
      await chrome.storage.local.set({ [treeKey(sessionId)]: tree });
    } catch (retryErr) {
      console.warn('[ChatTree] tree cache write failed after eviction:', retryErr);
    }
  }
  return tree;
}

export async function clearTree(sessionId: string): Promise<void> {
  await chrome.storage.local.remove(treeKey(sessionId));
}

// Removes every cached tree (issue #153 cache-clear control). Node metadata
// (bookmarks/tags) lives under its own key and is intentionally untouched.
export async function clearAllTrees(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const treeKeys = Object.keys(all).filter((key) => key.startsWith(TREE_KEY_PREFIX));
  if (treeKeys.length > 0) await chrome.storage.local.remove(treeKeys);
}

// Removes trees whose lastUpdated is older than the user's retention period
// (issue #153). storage.local never self-cleans, so this runs from the daily
// purge alarm and once on browser startup.
export async function purgeExpiredTrees(): Promise<void> {
  const settingsResult = await chrome.storage.local.get(STORAGE_KEYS.USER_SETTINGS);
  const settings = settingsResult[STORAGE_KEYS.USER_SETTINGS] as Partial<UserSettings> | undefined;
  const retentionDays = settings?.cacheRetentionDays ?? DEFAULT_SETTINGS.cacheRetentionDays;
  const cutoff = Date.now() - retentionDays * 86_400_000;

  const all = await chrome.storage.local.get(null);
  const expired = Object.entries(all)
    .filter(
      ([key, value]) =>
        key.startsWith(TREE_KEY_PREFIX) && ((value as TreeData).lastUpdated ?? 0) < cutoff,
    )
    .map(([key]) => key);

  if (expired.length > 0) await chrome.storage.local.remove(expired);
}

// Frees space after a quota failure: drops the oldest quarter of cached trees
// (at least one), never the tree being written. Only one retry follows, so a
// single pass must free enough — a proportional cut beats one-at-a-time.
async function evictOldestTrees(keepSessionId: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const trees = Object.entries(all)
    .filter(([key]) => key.startsWith(TREE_KEY_PREFIX) && key !== treeKey(keepSessionId))
    .sort(
      ([, a], [, b]) =>
        ((a as TreeData).lastUpdated ?? 0) - ((b as TreeData).lastUpdated ?? 0),
    );
  if (trees.length === 0) return;

  const evictCount = Math.max(1, Math.ceil(trees.length / 4));
  await chrome.storage.local.remove(trees.slice(0, evictCount).map(([key]) => key));
}
