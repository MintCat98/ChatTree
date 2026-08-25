// Per-node computed cache in chrome.storage.local: summaries (#158/#160) and
// relevance scores (#161). Both pipelines write here through one shared schema
// (issue #159) rather than each inventing its own storage.
// Keyed per conversation as `nodeCache_<sessionId>` — mirroring the tree cache's
// `tree_<sessionId>` — with a flat { [nodeId]: NodeCacheEntry } map per key. A
// per-session key keeps every read/write scoped to one conversation instead of
// rewriting a single all-sessions blob on each node update.
// Unlike node metadata (user data), this is a rebuildable cache: an entry is
// purged as soon as its conversation's cached tree is gone — no age-based GC.

import type { NodeCacheEntry, TreeData } from './types';
import type { NodeSummary } from './summary';
import { NODE_CACHE_KEY_PREFIX, TREE_KEY_PREFIX } from './constants';

type SessionNodeCache = Record<string, NodeCacheEntry>;

function cacheKey(sessionId: string): string {
  return `${NODE_CACHE_KEY_PREFIX}${sessionId}`;
}

export async function getSessionNodeCache(sessionId: string): Promise<SessionNodeCache> {
  const key = cacheKey(sessionId);
  const result = await chrome.storage.local.get(key);
  return (result[key] as SessionNodeCache | undefined) ?? {};
}

// Summary-only view of a session's cache, for the panel (issue #165).
// Deliberately a projection, not the raw entries: an embedding is ~2.8 KB per
// node (see EMBEDDING_STORED_DECIMALS) and the panel has no use for one, so
// dropping them here keeps vectors out of the content script entirely.
export function projectSummaries(cache: SessionNodeCache): Record<string, NodeSummary> {
  const summaries: Record<string, NodeSummary> = {};
  for (const [nodeId, entry] of Object.entries(cache)) {
    if (entry?.summary) summaries[nodeId] = entry.summary;
  }
  return summaries;
}

export async function getSessionSummaries(sessionId: string): Promise<Record<string, NodeSummary>> {
  return projectSummaries(await getSessionNodeCache(sessionId));
}

// Serializes every write. The read-modify-write below awaits between reading
// and writing, so two concurrent callers would both read the pre-write state
// and the second `set` would drop the first one's field. That is not
// hypothetical: the summary queue and the embedding queue (#160/#161) drain in
// parallel and patch different fields of the SAME entry, so an unserialized
// write loses whichever of summary/embedding finished first.
let writeChain: Promise<unknown> = Promise.resolve();

// Merges the patch into the existing node entry so summary (#160) and relevance
// (#161) can be written independently — one may be computed before the other.
export async function setNodeCache(
  sessionId: string,
  nodeId: string,
  patch: Partial<NodeCacheEntry>,
): Promise<void> {
  const write = writeChain.then(async () => {
    const nodes = await getSessionNodeCache(sessionId);
    nodes[nodeId] = { ...nodes[nodeId], ...patch }; // merge, not overwrite
    const commit = () => chrome.storage.local.set({ [cacheKey(sessionId)]: nodes });

    try {
      await commit();
    } catch {
      // Quota safety net. Embeddings (#161) made this the largest writer in
      // storage.local, and it shares the 10 MB area with the tree cache —
      // without this, a full area surfaces as trees silently failing to
      // persist, far from the cause.
      //
      // Escalate cheapest-first, retrying in between, rather than evicting in
      // one shot like session-store does for trees: an orphaned cache costs
      // nothing to lose, but a live one costs a full re-run of the model to
      // rebuild, so it is only sacrificed once the free option has failed.
      await purgeOrphanedNodeCache();
      try {
        await commit();
      } catch {
        await evictOldestNodeCaches(sessionId);
        await commit(); // last attempt — a throw here reaches the caller
      }
    }
  });
  // Swallow on the chain only — a failed write must not block later writes.
  // The caller still sees the rejection through the returned promise.
  writeChain = write.catch(() => {});
  return write;
}

// Last-resort space for a quota retry, mirroring session-store's
// evictOldestTrees: drop the oldest quarter of the OTHER sessions' caches (at
// least one), ordered by their tree's lastUpdated — the cache carries no
// timestamp of its own, and a stale tree means a stale cache. A proportional
// cut beats one-at-a-time when only one retry follows.
//
// Never touches the session being written; the caller is about to rewrite it.
async function evictOldestNodeCaches(keepSessionId: string): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const caches = Object.keys(all)
    .filter((key) => key.startsWith(NODE_CACHE_KEY_PREFIX) && key !== cacheKey(keepSessionId))
    .map((key) => {
      const tree = all[`${TREE_KEY_PREFIX}${key.slice(NODE_CACHE_KEY_PREFIX.length)}`];
      return { key, lastUpdated: (tree as TreeData | undefined)?.lastUpdated ?? 0 };
    })
    .sort((a, b) => a.lastUpdated - b.lastUpdated);
  if (caches.length === 0) return;

  const evictCount = Math.max(1, Math.ceil(caches.length / 4));
  await chrome.storage.local.remove(caches.slice(0, evictCount).map(({ key }) => key));
}

export async function clearSessionNodeCache(sessionId: string): Promise<void> {
  await chrome.storage.local.remove(cacheKey(sessionId));
}

// Clears the node cache for every conversation. Called alongside the tree-cache
// clear (issue #153 control): this derived cache must not outlive the trees it
// annotates — a revisit rebuilds the tree, after which purgeOrphanedNodeCache
// could never reach the stranded entries.
export async function clearAllNodeCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((key) => key.startsWith(NODE_CACHE_KEY_PREFIX));
  if (keys.length > 0) await chrome.storage.local.remove(keys);
}

// GCs cache for conversations whose tree no longer exists. Runs from the daily
// retention alarm after the tree purge (issue #153), so the orphan check sees
// the post-purge tree set. No grace period — a missing tree means dead cache.
export async function purgeOrphanedNodeCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const orphaned = Object.keys(all)
    .filter((key) => key.startsWith(NODE_CACHE_KEY_PREFIX))
    .filter((key) => !(`${TREE_KEY_PREFIX}${key.slice(NODE_CACHE_KEY_PREFIX.length)}` in all));
  if (orphaned.length > 0) await chrome.storage.local.remove(orphaned);
}
