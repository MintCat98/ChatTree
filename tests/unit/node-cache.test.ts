import {
  getSessionNodeCache,
  setNodeCache,
  clearSessionNodeCache,
  purgeOrphanedNodeCache,
} from '@shared/node-cache';
import type { NodeCacheEntry, NodeCacheStore } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

const mockStorage = new Map<string, unknown>();

const mockLocalStorage = {
  get: jest.fn(async (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      if (mockStorage.has(k)) result[k] = mockStorage.get(k);
    }
    return result;
  }),
  set: jest.fn(async (items: Record<string, unknown>) => {
    Object.entries(items).forEach(([k, v]) => mockStorage.set(k, v));
  }),
};

function seedSession(sessionId: string, nodes: Record<string, NodeCacheEntry>): void {
  const store = (mockStorage.get(STORAGE_KEYS.NODE_CACHE) as NodeCacheStore) ?? {};
  store[sessionId] = { nodes };            // ← lastUpdated 없음
  mockStorage.set(STORAGE_KEYS.NODE_CACHE, store);
}

function readSession(sessionId: string): NodeCacheStore[string] | undefined {
  const store = mockStorage.get(STORAGE_KEYS.NODE_CACHE) as NodeCacheStore | undefined;
  return store?.[sessionId];
}

const SUMMARY = { keyword: 'kw', question: 'q?', answer: 'a.' };

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();

  (global as unknown as { chrome: typeof chrome }).chrome = {
    storage: { local: mockLocalStorage },
  } as unknown as typeof chrome;
});

// ---------------------------------------------------------------------------
// getSessionNodeCache
// ---------------------------------------------------------------------------

describe('getSessionNodeCache', () => {
  it('returns {} when the session has no cache', async () => {
    expect(await getSessionNodeCache('sess-1')).toEqual({});
  });

  it('returns only the requested session nodes', async () => {
    seedSession('sess-1', { 'chatbox-0': { relevance: 0.9 } });
    seedSession('sess-2', { 'chatbox-0': { relevance: 0.1 } });

    expect(await getSessionNodeCache('sess-1')).toEqual({ 'chatbox-0': { relevance: 0.9 } });
  });
});

// ---------------------------------------------------------------------------
// setNodeCache
// ---------------------------------------------------------------------------

describe('setNodeCache', () => {
  it('creates a new node entry from the patch', async () => {
    await setNodeCache('sess-1', 'chatbox-0', { summary: SUMMARY });

    expect(readSession('sess-1')?.nodes).toEqual({ 'chatbox-0': { summary: SUMMARY } });
  });

  it('merges summary and relevance written in separate calls', async () => {
    await setNodeCache('sess-1', 'chatbox-0', { summary: SUMMARY });
    await setNodeCache('sess-1', 'chatbox-0', { relevance: 0.42 });

    expect(readSession('sess-1')?.nodes['chatbox-0']).toEqual({
      summary: SUMMARY,
      relevance: 0.42,
    });
  });

  it('does not affect other nodes in the same session', async () => {
    seedSession('sess-1', { 'chatbox-1': { relevance: 0.5 } });

    await setNodeCache('sess-1', 'chatbox-0', { relevance: 0.9 });

    expect(readSession('sess-1')?.nodes['chatbox-1']).toEqual({ relevance: 0.5 });
  });

  it('does not affect other sessions', async () => {
    seedSession('sess-2', { 'chatbox-0': { relevance: 0.5 } });

    await setNodeCache('sess-1', 'chatbox-0', { relevance: 0.9 });

    expect(readSession('sess-2')?.nodes['chatbox-0']).toEqual({ relevance: 0.5 });
  });
});

// ---------------------------------------------------------------------------
// clearSessionNodeCache
// ---------------------------------------------------------------------------

describe('clearSessionNodeCache', () => {
  it('removes the session entry from the store', async () => {
    seedSession('sess-1', { 'chatbox-0': { relevance: 1 } });
    seedSession('sess-2', { 'chatbox-0': { relevance: 1 } });

    await clearSessionNodeCache('sess-1');

    expect(readSession('sess-1')).toBeUndefined();
    expect(readSession('sess-2')).toBeDefined();
  });

  it('does not throw when the session has no cache', async () => {
    await expect(clearSessionNodeCache('nonexistent')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// purgeOrphanedNodeCache
// ---------------------------------------------------------------------------

describe('purgeOrphanedNodeCache', () => {
  it('removes cache for a session with no cached tree', async () => {
    seedSession('orphan', { 'chatbox-0': { summary: SUMMARY } });

    await purgeOrphanedNodeCache();

    expect(readSession('orphan')).toBeUndefined();
  });

  it('keeps cache when a cached tree still exists', async () => {
    seedSession('kept', { 'chatbox-0': { summary: SUMMARY } });
    mockStorage.set('tree_kept', {
      sessionId: 'kept',
      nodes: [],
      activeBranchPath: [],
      lastUpdated: 0,
    });

    await purgeOrphanedNodeCache();

    expect(readSession('kept')).toBeDefined();
  });

  it('does nothing when the store is empty', async () => {
    await purgeOrphanedNodeCache();

    expect(mockLocalStorage.set).not.toHaveBeenCalled();
  });
});