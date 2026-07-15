// Unit tests for session-store — per-conversation tree state management
// (keyed by sessionId so any tab/window can hydrate the same tree, issue #152).

import { getTree, updateTree, clearTree, purgeExpiredTrees } from '@background/session-store';
import type { ChatboxNode, TreeData } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

// ---------------------------------------------------------------------------
// chrome.storage.local mock
// ---------------------------------------------------------------------------

const mockStorage = new Map<string, unknown>();

const mockLocalStorage = {
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
    (Array.isArray(key) ? key : [key]).forEach((k) => mockStorage.delete(k));
  }),
};

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();

  (global as unknown as { chrome: typeof chrome }).chrome = {
    storage: {
      local: mockLocalStorage,
    },
  } as unknown as typeof chrome;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeNode(id: string, index: number): ChatboxNode {
  return {
    id,
    index,
    text: `prompt ${index}`,
    hasBranch: false,
    branchCurrent: 1,
    branchTotal: 1,
    parentId: null,
  };
}

// ---------------------------------------------------------------------------
// getTree
// ---------------------------------------------------------------------------

describe('getTree', () => {
  it('returns null for an unknown sessionId', async () => {
    const result = await getTree(SESSION_ID);
    expect(result).toBeNull();
  });

  it('returns the stored TreeData for a known sessionId', async () => {
    const tree: TreeData = {
      sessionId: SESSION_ID,
      nodes: [makeNode('chatbox-0', 0)],
      activeBranchPath: ['chatbox-0'],
      lastUpdated: 1000,
    };
    mockStorage.set(`tree_${SESSION_ID}`, tree);

    const result = await getTree(SESSION_ID);
    expect(result).toEqual(tree);
  });
});

// ---------------------------------------------------------------------------
// updateTree
// ---------------------------------------------------------------------------

describe('updateTree', () => {
  it('stores TreeData under the key tree_<sessionId>', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    await updateTree(SESSION_ID, nodes);

    expect(mockLocalStorage.set).toHaveBeenCalledWith(
      expect.objectContaining({ [`tree_${SESSION_ID}`]: expect.any(Object) }),
    );
  });

  it('uses the provided activeBranchPath', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(SESSION_ID, nodes, ['chatbox-0']);

    expect(tree.activeBranchPath).toEqual(['chatbox-0']);
  });

  it('preserves the existing activeBranchPath when arg is undefined', async () => {
    // Store an initial tree with a known activeBranchPath
    const initial: TreeData = {
      sessionId: SESSION_ID,
      nodes: [],
      activeBranchPath: ['chatbox-1'],
      lastUpdated: 0,
    };
    mockStorage.set(`tree_${SESSION_ID}`, initial);

    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(SESSION_ID, nodes);

    expect(tree.activeBranchPath).toEqual(['chatbox-1']);
  });

  it('defaults activeBranchPath to [] when no prior tree and arg is undefined', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(SESSION_ID, nodes);

    expect(tree.activeBranchPath).toEqual([]);
  });

  it('sets lastUpdated close to Date.now()', async () => {
    const before = Date.now();
    const tree = await updateTree(SESSION_ID, []);
    const after = Date.now();

    expect(tree.lastUpdated).toBeGreaterThanOrEqual(before);
    expect(tree.lastUpdated).toBeLessThanOrEqual(after);
  });

  it('returns the stored TreeData', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(SESSION_ID, nodes, ['chatbox-0']);

    expect(tree).toMatchObject({
      sessionId: SESSION_ID,
      nodes: expect.arrayContaining([expect.objectContaining({ id: 'chatbox-0' })]),
      activeBranchPath: ['chatbox-0'],
    });
  });

  it('strips the element field from nodes before storing', async () => {
    // Simulate a DOM reference that tracker.ts might attach (not in the public type)
    const nodeWithElement = {
      ...makeNode('chatbox-0', 0),
      element: { tagName: 'DIV' }, // plain object standing in for HTMLElement
    } as ChatboxNode & { element: object };

    const tree = await updateTree(SESSION_ID, [nodeWithElement]);

    expect(tree.nodes[0]).not.toHaveProperty('element');
    expect(tree.nodes[0]).toMatchObject(makeNode('chatbox-0', 0));
  });

  it('isolates state between conversations', async () => {
    await updateTree('sess-A', [makeNode('a', 0)]);
    await updateTree('sess-B', [makeNode('b', 0)]);

    expect((await getTree('sess-A'))?.sessionId).toBe('sess-A');
    expect((await getTree('sess-B'))?.sessionId).toBe('sess-B');

    await clearTree('sess-A');

    expect(await getTree('sess-A')).toBeNull();
    expect((await getTree('sess-B'))?.sessionId).toBe('sess-B');
  });
});

// ---------------------------------------------------------------------------
// clearTree
// ---------------------------------------------------------------------------

describe('clearTree', () => {
  it('removes the entry from storage', async () => {
    mockStorage.set(`tree_${SESSION_ID}`, { sessionId: 'x', nodes: [], activeBranchPath: [], lastUpdated: 0 });

    await clearTree(SESSION_ID);

    expect(mockLocalStorage.remove).toHaveBeenCalledWith(`tree_${SESSION_ID}`);
    expect(mockStorage.has(`tree_${SESSION_ID}`)).toBe(false);
  });

  it('does not throw when the key does not exist', async () => {
    await expect(clearTree(SESSION_ID)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// purgeExpiredTrees (issue #153)
// ---------------------------------------------------------------------------

const DAY = 86_400_000;

function seedTree(sessionId: string, lastUpdated: number): void {
  mockStorage.set(`tree_${sessionId}`, {
    sessionId,
    nodes: [],
    activeBranchPath: [],
    lastUpdated,
  } satisfies TreeData);
}

describe('purgeExpiredTrees', () => {
  it('removes trees older than the default 30-day retention when no settings are stored', async () => {
    seedTree('old', Date.now() - 31 * DAY);
    seedTree('fresh', Date.now() - 1 * DAY);

    await purgeExpiredTrees();

    expect(mockStorage.has('tree_old')).toBe(false);
    expect(mockStorage.has('tree_fresh')).toBe(true);
  });

  it('respects cacheRetentionDays from stored settings', async () => {
    mockStorage.set(STORAGE_KEYS.USER_SETTINGS, { cacheRetentionDays: 7 });
    seedTree('stale', Date.now() - 8 * DAY);
    seedTree('recent', Date.now() - 6 * DAY);

    await purgeExpiredTrees();

    expect(mockStorage.has('tree_stale')).toBe(false);
    expect(mockStorage.has('tree_recent')).toBe(true);
  });

  it('falls back to the default retention when settings lack cacheRetentionDays', async () => {
    mockStorage.set(STORAGE_KEYS.USER_SETTINGS, { sortOrder: 'asc' });
    seedTree('old', Date.now() - 31 * DAY);

    await purgeExpiredTrees();

    expect(mockStorage.has('tree_old')).toBe(false);
  });

  it('never touches non-tree keys', async () => {
    mockStorage.set(STORAGE_KEYS.USER_SETTINGS, { cacheRetentionDays: 7 });
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, { 'sess-A': {} });
    seedTree('stale', Date.now() - 100 * DAY);

    await purgeExpiredTrees();

    expect(mockStorage.has(STORAGE_KEYS.USER_SETTINGS)).toBe(true);
    expect(mockStorage.has(STORAGE_KEYS.NODE_METADATA)).toBe(true);
  });

  it('does nothing when no trees are expired', async () => {
    seedTree('fresh', Date.now());

    await purgeExpiredTrees();

    expect(mockLocalStorage.remove).not.toHaveBeenCalled();
    expect(mockStorage.has('tree_fresh')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateTree — quota eviction safety net (issue #153)
// ---------------------------------------------------------------------------

describe('updateTree quota eviction', () => {
  it('evicts the oldest trees (never the current session) and retries once on a failed write', async () => {
    seedTree('oldest', 1000);
    seedTree('newer', 2000);
    seedTree('newest', 3000);
    seedTree(SESSION_ID, 500); // current session — oldest of all, must survive

    mockLocalStorage.set.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));

    const tree = await updateTree(SESSION_ID, [makeNode('chatbox-0', 0)]);

    // ceil(3 / 4) = 1 → only the oldest non-current tree is evicted
    expect(mockStorage.has('tree_oldest')).toBe(false);
    expect(mockStorage.has('tree_newer')).toBe(true);
    expect(mockStorage.has('tree_newest')).toBe(true);
    // Retry succeeded — the current tree is stored
    expect(mockStorage.has(`tree_${SESSION_ID}`)).toBe(true);
    expect(tree.nodes[0].id).toBe('chatbox-0');
  });

  it('does not throw when the retry also fails', async () => {
    seedTree('other', 1000);
    mockLocalStorage.set
      .mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))
      .mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const tree = await updateTree(SESSION_ID, [makeNode('chatbox-0', 0)]);
    warn.mockRestore();

    // The in-memory tree is still returned so the panel keeps working
    expect(tree.sessionId).toBe(SESSION_ID);
    expect(mockStorage.has(`tree_${SESSION_ID}`)).toBe(false);
  });
});
