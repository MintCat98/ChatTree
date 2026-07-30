// Per-node metadata persistence in chrome.storage.local.
// Shape on disk (v2, issue #153):
//   NodeMetadataStore = { [sessionId]: { nodes: { [nodeId]: NodeMetadata }, lastUpdated } }
// v1 (issue #96) stored the node map directly; readStore migrates legacy
// entries and persists the migration once.

import type { NodeMetadata, NodeMetadataStore, SessionMetadata } from './types';
import { DEFAULT_NODE_METADATA } from './types';
import { STORAGE_KEYS, TREE_KEY_PREFIX } from './constants';

const KEY = STORAGE_KEYS.NODE_METADATA;

// Orphaned-metadata GC horizon. Deliberately much longer than the tree-cache
// retention (default 30 days): bookmarks/tags are user data, not a rebuildable
// cache, and they re-attach when a conversation is revisited (deterministic
// position-based node IDs). Only metadata that has no cached tree AND has not
// been touched for this long — e.g. conversations deleted on claude.ai — is
// collected.
export const METADATA_RETENTION_DAYS = 180;

// getSessionMetadata runs on every TREE_READY (frequent during streaming), so
// the visit-refresh of lastUpdated only writes when the stamp is older than
// this — GC operates at day granularity anyway.
const TOUCH_WRITE_THRESHOLD_MS = 60 * 60 * 1000;

type LegacySessionMetadata = Record<string, NodeMetadata>;

// Node IDs are "chatbox-N", so a legacy node map can never have a 'nodes' key.
function migrate(entry: SessionMetadata | LegacySessionMetadata): SessionMetadata {
  if ('nodes' in entry && typeof entry.nodes === 'object') return entry as SessionMetadata;
  return { nodes: entry as LegacySessionMetadata, lastUpdated: Date.now() };
}

async function readStore(): Promise<NodeMetadataStore> {
  const result = await chrome.storage.local.get(KEY);
  const raw =
    (result[KEY] as Record<string, SessionMetadata | LegacySessionMetadata> | undefined) ?? {};

  const store: NodeMetadataStore = {};
  let migrated = false;
  for (const [sessionId, entry] of Object.entries(raw)) {
    const upgraded = migrate(entry);
    if (upgraded !== entry) migrated = true;
    store[sessionId] = upgraded;
  }
  // Persist the one-time v1 → v2 migration so legacy entries get a fixed
  // timestamp (otherwise every read would re-stamp them and GC never fires).
  if (migrated) await writeStore(store);
  return store;
}

async function writeStore(store: NodeMetadataStore): Promise<void> {
  await chrome.storage.local.set({ [KEY]: store });
}

export async function getSessionMetadata(sessionId: string): Promise<Record<string, NodeMetadata>> {
  const store = await readStore();
  const entry = store[sessionId];
  if (!entry) return {};

  // Visiting refreshes the GC clock so actively viewed sessions never expire.
  const now = Date.now();
  if (now - entry.lastUpdated > TOUCH_WRITE_THRESHOLD_MS) {
    entry.lastUpdated = now;
    await writeStore(store);
  }
  return entry.nodes;
}

export async function setNodeMetadata(
  sessionId: string,
  nodeId: string,
  patch: Partial<NodeMetadata>,
): Promise<void> {
  const store = await readStore();
  const entry = store[sessionId] ?? { nodes: {}, lastUpdated: 0 };
  store[sessionId] = {
    nodes: {
      ...entry.nodes,
      [nodeId]: { ...DEFAULT_NODE_METADATA, ...entry.nodes[nodeId], ...patch },
    },
    lastUpdated: Date.now(),
  };
  await writeStore(store);
}

// Applies the same patch to several nodes in ONE read-modify-write. Calling
// setNodeMetadata N times in parallel would have each call read the store
// before the others wrote, so all but the last patch would be lost. Used when
// expanding a collapsed run (issue #167).
export async function setNodeMetadataBatch(
  sessionId: string,
  nodeIds: string[],
  patch: Partial<NodeMetadata>,
): Promise<void> {
  if (nodeIds.length === 0) return;

  const store = await readStore();
  const entry = store[sessionId] ?? { nodes: {}, lastUpdated: 0 };
  const nodes = { ...entry.nodes };
  for (const nodeId of nodeIds) {
    nodes[nodeId] = { ...DEFAULT_NODE_METADATA, ...nodes[nodeId], ...patch };
  }
  store[sessionId] = { nodes, lastUpdated: Date.now() };
  await writeStore(store);
}

export async function clearSessionMetadata(sessionId: string): Promise<void> {
  const store = await readStore();
  delete store[sessionId];
  await writeStore(store);
}

// Garbage-collects metadata for sessions with no cached tree that have not been
// touched for METADATA_RETENTION_DAYS (issue #153). Runs from the same daily
// alarm as the tree purge, after it, so the orphan check sees the post-purge
// tree set.
export async function purgeOrphanedMetadata(): Promise<void> {
  const store = await readStore();
  const sessionIds = Object.keys(store);
  if (sessionIds.length === 0) return;

  const trees = await chrome.storage.local.get(
    sessionIds.map((id) => `${TREE_KEY_PREFIX}${id}`),
  );
  const cutoff = Date.now() - METADATA_RETENTION_DAYS * 86_400_000;

  let changed = false;
  for (const sessionId of sessionIds) {
    const hasTree = `${TREE_KEY_PREFIX}${sessionId}` in trees;
    if (!hasTree && store[sessionId].lastUpdated < cutoff) {
      delete store[sessionId];
      changed = true;
    }
  }
  if (changed) await writeStore(store);
}
