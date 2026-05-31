// Unit tests for session-store — per-tab tree state management.

import { getTree, updateTree, clearTree } from '@background/session-store';
import type { ChatboxNode, TreeData } from '@shared/types';

// ---------------------------------------------------------------------------
// chrome.storage.session mock
// ---------------------------------------------------------------------------

const mockStorage = new Map<string, unknown>();

const mockSessionStorage = {
  get: jest.fn(async (key: string) => {
    return mockStorage.has(key) ? { [key]: mockStorage.get(key) } : {};
  }),
  set: jest.fn(async (items: Record<string, unknown>) => {
    Object.entries(items).forEach(([k, v]) => mockStorage.set(k, v));
  }),
  remove: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
};

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();

  (global as unknown as { chrome: typeof chrome }).chrome = {
    storage: {
      session: mockSessionStorage,
    },
  } as unknown as typeof chrome;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TAB_ID = 42;

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
  it('returns null for an unknown tabId', async () => {
    const result = await getTree(TAB_ID);
    expect(result).toBeNull();
  });

  it('returns the stored TreeData for a known tabId', async () => {
    const tree: TreeData = {
      sessionId: 'sess-1',
      nodes: [makeNode('chatbox-0', 0)],
      activeBranchPath: ['chatbox-0'],
      lastUpdated: 1000,
    };
    mockStorage.set(`tree_${TAB_ID}`, tree);

    const result = await getTree(TAB_ID);
    expect(result).toEqual(tree);
  });
});

// ---------------------------------------------------------------------------
// updateTree
// ---------------------------------------------------------------------------

describe('updateTree', () => {
  it('stores TreeData under the key tree_<tabId>', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    await updateTree(TAB_ID, nodes, 'sess-1');

    expect(mockSessionStorage.set).toHaveBeenCalledWith(
      expect.objectContaining({ [`tree_${TAB_ID}`]: expect.any(Object) }),
    );
  });

  it('uses the provided activeBranchPath', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(TAB_ID, nodes, 'sess-1', ['chatbox-0']);

    expect(tree.activeBranchPath).toEqual(['chatbox-0']);
  });

  it('preserves the existing activeBranchPath when arg is undefined', async () => {
    // Store an initial tree with a known activeBranchPath
    const initial: TreeData = {
      sessionId: 'sess-1',
      nodes: [],
      activeBranchPath: ['chatbox-1'],
      lastUpdated: 0,
    };
    mockStorage.set(`tree_${TAB_ID}`, initial);

    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(TAB_ID, nodes, 'sess-1');

    expect(tree.activeBranchPath).toEqual(['chatbox-1']);
  });

  it('defaults activeBranchPath to [] when no prior tree and arg is undefined', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(TAB_ID, nodes, 'sess-1');

    expect(tree.activeBranchPath).toEqual([]);
  });

  it('sets lastUpdated close to Date.now()', async () => {
    const before = Date.now();
    const tree = await updateTree(TAB_ID, [], 'sess-1');
    const after = Date.now();

    expect(tree.lastUpdated).toBeGreaterThanOrEqual(before);
    expect(tree.lastUpdated).toBeLessThanOrEqual(after);
  });

  it('returns the stored TreeData', async () => {
    const nodes = [makeNode('chatbox-0', 0)];
    const tree = await updateTree(TAB_ID, nodes, 'sess-1', ['chatbox-0']);

    expect(tree).toMatchObject({
      sessionId: 'sess-1',
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

    const tree = await updateTree(TAB_ID, [nodeWithElement], 'sess-1');

    expect(tree.nodes[0]).not.toHaveProperty('element');
    expect(tree.nodes[0]).toMatchObject(makeNode('chatbox-0', 0));
  });

  it('works correctly with tabId = 0', async () => {
    const tree = await updateTree(0, [], 'sess-zero');
    expect(tree.sessionId).toBe('sess-zero');
    expect(mockSessionStorage.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'tree_0': expect.any(Object) }),
    );
  });

  it('isolates state between tabs', async () => {
    await updateTree(1, [makeNode('a', 0)], 'sess-A');
    await updateTree(2, [makeNode('b', 0)], 'sess-B');

    expect((await getTree(1))?.sessionId).toBe('sess-A');
    expect((await getTree(2))?.sessionId).toBe('sess-B');

    await clearTree(1);

    expect(await getTree(1)).toBeNull();
    expect((await getTree(2))?.sessionId).toBe('sess-B');
  });
});

// ---------------------------------------------------------------------------
// clearTree
// ---------------------------------------------------------------------------

describe('clearTree', () => {
  it('removes the entry from storage', async () => {
    mockStorage.set(`tree_${TAB_ID}`, { sessionId: 'x', nodes: [], activeBranchPath: [], lastUpdated: 0 });

    await clearTree(TAB_ID);

    expect(mockSessionStorage.remove).toHaveBeenCalledWith(`tree_${TAB_ID}`);
    expect(mockStorage.has(`tree_${TAB_ID}`)).toBe(false);
  });

  it('does not throw when the key does not exist', async () => {
    await expect(clearTree(TAB_ID)).resolves.toBeUndefined();
  });
});
