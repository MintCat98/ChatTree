import {
  getSessionNodeCache,
  setNodeCache,
  clearSessionNodeCache,
  clearAllNodeCache,
  purgeOrphanedNodeCache,
} from '@shared/node-cache';
import type { NodeCacheEntry } from '@shared/types';
import { NODE_CACHE_KEY_PREFIX, TREE_KEY_PREFIX } from '@shared/constants';

const mockStorage = new Map<string, unknown>();

const mockLocalStorage = {
  // Mirrors chrome.storage.local.get: string, string[], or null (whole store).
  get: jest.fn(async (key: string | string[] | null) => {
    if (key === null) return Object.fromEntries(mockStorage);
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
  remove: jest.fn(async (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    keys.forEach((k) => mockStorage.delete(k));
  }),
};

function cacheKey(sessionId: string): string {
  return `${NODE_CACHE_KEY_PREFIX}${sessionId}`;
}

function seedSession(sessionId: string, nodes: Record<string, NodeCacheEntry>): void {
  mockStorage.set(cacheKey(sessionId), nodes);
}

function readSession(sessionId: string): Record<string, NodeCacheEntry> | undefined {
  return mockStorage.get(cacheKey(sessionId)) as Record<string, NodeCacheEntry> | undefined;
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
    seedSession('sess-1', { 'chatbox-0': { embedding: [0.9, 0.1] } });
    seedSession('sess-2', { 'chatbox-0': { embedding: [0.1, 0.9] } });

    expect(await getSessionNodeCache('sess-1')).toEqual({ 'chatbox-0': { embedding: [0.9, 0.1] } });
  });
});

// ---------------------------------------------------------------------------
// setNodeCache
// ---------------------------------------------------------------------------

describe('setNodeCache', () => {
  it('creates a new node entry from the patch', async () => {
    await setNodeCache('sess-1', 'chatbox-0', { summary: SUMMARY });

    expect(readSession('sess-1')).toEqual({ 'chatbox-0': { summary: SUMMARY } });
  });

  it('merges summary and embedding written in separate calls', async () => {
    await setNodeCache('sess-1', 'chatbox-0', { summary: SUMMARY });
    await setNodeCache('sess-1', 'chatbox-0', { embedding: [0.42, 0.1] });

    expect(readSession('sess-1')?.['chatbox-0']).toEqual({
      summary: SUMMARY,
      embedding: [0.42, 0.1],
    });
  });

  it('writes only the target session key', async () => {
    await setNodeCache('sess-1', 'chatbox-0', { embedding: [0.9, 0.1] });

    expect(mockLocalStorage.set).toHaveBeenCalledWith({
      [cacheKey('sess-1')]: { 'chatbox-0': { embedding: [0.9, 0.1] } },
    });
  });

  it('does not affect other nodes in the same session', async () => {
    seedSession('sess-1', { 'chatbox-1': { embedding: [0.5, 0.5] } });

    await setNodeCache('sess-1', 'chatbox-0', { embedding: [0.9, 0.1] });

    expect(readSession('sess-1')?.['chatbox-1']).toEqual({ embedding: [0.5, 0.5] });
  });

  it('does not affect other sessions', async () => {
    seedSession('sess-2', { 'chatbox-0': { embedding: [0.5, 0.5] } });

    await setNodeCache('sess-1', 'chatbox-0', { embedding: [0.9, 0.1] });

    expect(readSession('sess-2')?.['chatbox-0']).toEqual({ embedding: [0.5, 0.5] });
  });
});

// ---------------------------------------------------------------------------
// clearSessionNodeCache
// ---------------------------------------------------------------------------

describe('clearSessionNodeCache', () => {
  it('removes the session entry from the store', async () => {
    seedSession('sess-1', { 'chatbox-0': { embedding: [1, 0] } });
    seedSession('sess-2', { 'chatbox-0': { embedding: [1, 0] } });

    await clearSessionNodeCache('sess-1');

    expect(readSession('sess-1')).toBeUndefined();
    expect(readSession('sess-2')).toBeDefined();
  });

  it('does not throw when the session has no cache', async () => {
    await expect(clearSessionNodeCache('nonexistent')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clearAllNodeCache
// ---------------------------------------------------------------------------

describe('clearAllNodeCache', () => {
  it('removes every node-cache key but leaves other storage untouched', async () => {
    seedSession('sess-1', { 'chatbox-0': { embedding: [1, 0] } });
    seedSession('sess-2', { 'chatbox-0': { embedding: [1, 0] } });
    mockStorage.set(`${TREE_KEY_PREFIX}sess-1`, { sessionId: 'sess-1' });
    mockStorage.set('userSettings', { cacheRetentionDays: 30 });

    await clearAllNodeCache();

    expect(readSession('sess-1')).toBeUndefined();
    expect(readSession('sess-2')).toBeUndefined();
    expect(mockStorage.get(`${TREE_KEY_PREFIX}sess-1`)).toBeDefined();
    expect(mockStorage.get('userSettings')).toBeDefined();
  });

  it('does nothing when there is no node cache', async () => {
    await clearAllNodeCache();

    expect(mockLocalStorage.remove).not.toHaveBeenCalled();
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
    mockStorage.set(`${TREE_KEY_PREFIX}kept`, {
      sessionId: 'kept',
      nodes: [],
      activeBranchPath: [],
      lastUpdated: 0,
    });

    await purgeOrphanedNodeCache();

    expect(readSession('kept')).toBeDefined();
  });

  it('purges only the orphaned sessions in a mixed store', async () => {
    seedSession('orphan', { 'chatbox-0': { summary: SUMMARY } });
    seedSession('kept', { 'chatbox-0': { summary: SUMMARY } });
    mockStorage.set(`${TREE_KEY_PREFIX}kept`, { sessionId: 'kept' });

    await purgeOrphanedNodeCache();

    expect(readSession('orphan')).toBeUndefined();
    expect(readSession('kept')).toBeDefined();
  });

  it('does nothing when the store is empty', async () => {
    await purgeOrphanedNodeCache();

    expect(mockLocalStorage.remove).not.toHaveBeenCalled();
  });
});
