// Per-node computed cache in chrome.storage.local: summaries (#158/#160) and
// relevance scores (#161). Both pipelines write here through one shared schema
// (issue #159) rather than each inventing its own storage.
// Shape on disk:
//   NodeCacheStore = { [sessionId]: { nodes: { [nodeId]: NodeCacheEntry } } }
// Unlike node metadata (user data), this is a rebuildable cache: an entry is
// purged as soon as its conversation's cached tree is gone — no age-based GC.

import type { NodeCacheEntry, NodeCacheStore } from './types';
import { STORAGE_KEYS, TREE_KEY_PREFIX } from './constants';

const KEY = STORAGE_KEYS.NODE_CACHE;

async function readStore(): Promise<NodeCacheStore> {
  const result = await chrome.storage.local.get(KEY);
  return (result[KEY] as NodeCacheStore | undefined) ?? {};
}

async function writeStore(store: NodeCacheStore): Promise<void> {
  await chrome.storage.local.set({ [KEY]: store });
}

export async function getSessionNodeCache(
  sessionId: string,
): Promise<Record<string, NodeCacheEntry>> {
  const store = await readStore();
  return store[sessionId]?.nodes ?? {};
}

// Merges the patch into the existing node entry so summary (#160) and relevance
// (#161) can be written independently — one may be computed before the other.
export async function setNodeCache(
  sessionId: string,
  nodeId: string,
  patch: Partial<NodeCacheEntry>,
): Promise<void> {
  const store = await readStore();
  const entry = store[sessionId] ?? { nodes: {} };
  store[sessionId] = {
    nodes: {
      ...entry.nodes,
      [nodeId]: { ...entry.nodes[nodeId], ...patch }, // merge, not overwrite
    },
  };
  await writeStore(store);
}

export async function clearSessionNodeCache(sessionId: string): Promise<void> {
  const store = await readStore();
  if (!(sessionId in store)) return;
  delete store[sessionId];
  await writeStore(store);
}

// GCs cache for sessions whose tree no longer exists. Runs from the daily
// retention alarm after the tree purge (issue #153), so the orphan check sees
// the post-purge tree set. No grace period — a missing tree means dead cache.
export async function purgeOrphanedNodeCache(): Promise<void> {
  const store = await readStore();
  const sessionIds = Object.keys(store);
  if (sessionIds.length === 0) return;

  const trees = await chrome.storage.local.get(
    sessionIds.map((id) => `${TREE_KEY_PREFIX}${id}`),
  );

  let changed = false;
  for (const sessionId of sessionIds) {
    if (!(`${TREE_KEY_PREFIX}${sessionId}` in trees)) {
      delete store[sessionId];
      changed = true;
    }
  }
  if (changed) await writeStore(store);
}