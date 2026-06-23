// Per-node metadata persistence in chrome.storage.local.
// Shape on disk: NodeMetadataStore = { [sessionId]: { [nodeId]: NodeMetadata } }

import type { NodeMetadata, NodeMetadataStore } from './types';
import { DEFAULT_NODE_METADATA } from './types';
import { STORAGE_KEYS } from './constants';

const KEY = STORAGE_KEYS.NODE_METADATA;

async function readStore(): Promise<NodeMetadataStore> {
  const result = await chrome.storage.local.get(KEY);
  return (result[KEY] as NodeMetadataStore | undefined) ?? {};
}

async function writeStore(store: NodeMetadataStore): Promise<void> {
  await chrome.storage.local.set({ [KEY]: store });
}

export async function getSessionMetadata(sessionId: string): Promise<Record<string, NodeMetadata>> {
  const store = await readStore();
  return store[sessionId] ?? {};
}

export async function setNodeMetadata(
  sessionId: string,
  nodeId: string,
  patch: Partial<NodeMetadata>,
): Promise<void> {
  const store = await readStore();
  const session = store[sessionId] ?? {};
  store[sessionId] = {
    ...session,
    [nodeId]: { ...DEFAULT_NODE_METADATA, ...session[nodeId], ...patch },
  };
  await writeStore(store);
}

export async function clearSessionMetadata(sessionId: string): Promise<void> {
  const store = await readStore();
  delete store[sessionId];
  await writeStore(store);
}
