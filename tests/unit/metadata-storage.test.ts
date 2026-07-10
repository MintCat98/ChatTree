// Unit tests for metadata-storage helpers (issue #96; v2 envelope + GC, issue #153).

import {
  getSessionMetadata,
  setNodeMetadata,
  clearSessionMetadata,
  purgeOrphanedMetadata,
  METADATA_RETENTION_DAYS,
} from '@shared/metadata-storage';
import type { NodeMetadata, NodeMetadataStore } from '@shared/types';
import { DEFAULT_NODE_METADATA } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

// ---------------------------------------------------------------------------
// chrome.storage.local mock
// ---------------------------------------------------------------------------

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

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();

  (global as unknown as { chrome: typeof chrome }).chrome = {
    storage: { local: mockLocalStorage },
  } as unknown as typeof chrome;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const HOUR = 3_600_000;

function seedSession(
  sessionId: string,
  nodes: Record<string, NodeMetadata>,
  lastUpdated: number,
): void {
  const store = (mockStorage.get(STORAGE_KEYS.NODE_METADATA) as NodeMetadataStore) ?? {};
  store[sessionId] = { nodes, lastUpdated };
  mockStorage.set(STORAGE_KEYS.NODE_METADATA, store);
}

function readSession(sessionId: string): NodeMetadataStore[string] | undefined {
  const store = mockStorage.get(STORAGE_KEYS.NODE_METADATA) as NodeMetadataStore | undefined;
  return store?.[sessionId];
}

// ---------------------------------------------------------------------------
// getSessionMetadata
// ---------------------------------------------------------------------------

describe('getSessionMetadata', () => {
  it('returns {} when session has no metadata', async () => {
    const result = await getSessionMetadata('sess-1');
    expect(result).toEqual({});
  });

  it('returns only the requested session nodes', async () => {
    seedSession('sess-1', { 'chatbox-0': { bookmarked: true, tags: ['important'] } }, Date.now());
    seedSession('sess-2', { 'chatbox-0': { bookmarked: false, tags: [] } }, Date.now());

    const result = await getSessionMetadata('sess-1');
    expect(result).toEqual({ 'chatbox-0': { bookmarked: true, tags: ['important'] } });
  });

  it('reads a legacy v1 entry (bare node map) and persists the migration', async () => {
    // v1 shape: sessionId → nodeId → NodeMetadata, no envelope
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      'sess-1': { 'chatbox-0': { bookmarked: true, tags: ['legacy'] } },
    });

    const result = await getSessionMetadata('sess-1');

    expect(result).toEqual({ 'chatbox-0': { bookmarked: true, tags: ['legacy'] } });
    const migrated = readSession('sess-1');
    expect(migrated?.nodes).toEqual({ 'chatbox-0': { bookmarked: true, tags: ['legacy'] } });
    expect(migrated?.lastUpdated).toBeGreaterThan(0);
  });

  it('refreshes lastUpdated when the stamp is stale (visit resets the GC clock)', async () => {
    const stale = Date.now() - 2 * DAY;
    seedSession('sess-1', {}, stale);

    await getSessionMetadata('sess-1');

    expect(readSession('sess-1')?.lastUpdated).toBeGreaterThan(stale);
  });

  it('skips the write when the stamp is fresh (avoids per-TREE_READY churn)', async () => {
    seedSession('sess-1', {}, Date.now() - HOUR / 2);

    await getSessionMetadata('sess-1');

    expect(mockLocalStorage.set).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setNodeMetadata
// ---------------------------------------------------------------------------

describe('setNodeMetadata', () => {
  it('creates a new node entry with defaults merged with patch', async () => {
    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    expect(readSession('sess-1')?.nodes).toEqual({
      'chatbox-0': { bookmarked: true, tags: [] },
    });
  });

  it('stamps lastUpdated on every write', async () => {
    const before = Date.now();
    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    expect(readSession('sess-1')?.lastUpdated).toBeGreaterThanOrEqual(before);
  });

  it('patches an existing entry without overwriting unchanged fields', async () => {
    seedSession('sess-1', { 'chatbox-0': { bookmarked: false, tags: ['a', 'b'] } }, 0);

    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    expect(readSession('sess-1')?.nodes['chatbox-0']).toEqual({
      bookmarked: true,
      tags: ['a', 'b'],
    });
  });

  it('does not affect other nodes in the same session', async () => {
    seedSession(
      'sess-1',
      {
        'chatbox-0': { bookmarked: false, tags: [] },
        'chatbox-1': { bookmarked: true, tags: ['x'] },
      },
      0,
    );

    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    expect(readSession('sess-1')?.nodes['chatbox-1']).toEqual({ bookmarked: true, tags: ['x'] });
  });

  it('does not affect other sessions', async () => {
    seedSession('sess-2', { 'chatbox-0': { bookmarked: true, tags: ['keep'] } }, 0);

    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    expect(readSession('sess-2')?.nodes['chatbox-0']).toEqual({
      bookmarked: true,
      tags: ['keep'],
    });
  });

  it('DEFAULT_NODE_METADATA is the base when no prior entry exists', async () => {
    await setNodeMetadata('sess-1', 'chatbox-0', {});

    expect(readSession('sess-1')?.nodes['chatbox-0']).toEqual(DEFAULT_NODE_METADATA);
  });

  it('upgrades a legacy v1 session entry on write', async () => {
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      'sess-1': { 'chatbox-0': { bookmarked: true, tags: ['legacy'] } },
    });

    await setNodeMetadata('sess-1', 'chatbox-1', { bookmarked: true });

    expect(readSession('sess-1')?.nodes).toEqual({
      'chatbox-0': { bookmarked: true, tags: ['legacy'] },
      'chatbox-1': { bookmarked: true, tags: [] },
    });
  });
});

// ---------------------------------------------------------------------------
// clearSessionMetadata
// ---------------------------------------------------------------------------

describe('clearSessionMetadata', () => {
  it('removes the session entry from the store', async () => {
    seedSession('sess-1', { 'chatbox-0': { bookmarked: true, tags: [] } }, 0);
    seedSession('sess-2', { 'chatbox-0': { bookmarked: false, tags: [] } }, 0);

    await clearSessionMetadata('sess-1');

    expect(readSession('sess-1')).toBeUndefined();
    expect(readSession('sess-2')).toBeDefined();
  });

  it('does not throw when the session has no metadata', async () => {
    await expect(clearSessionMetadata('nonexistent')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// purgeOrphanedMetadata (issue #153)
// ---------------------------------------------------------------------------

describe('purgeOrphanedMetadata', () => {
  const EXPIRED = Date.now() - (METADATA_RETENTION_DAYS + 1) * DAY;

  it('removes metadata with no cached tree that is past the retention horizon', async () => {
    seedSession('orphan', { 'chatbox-0': { bookmarked: true, tags: [] } }, EXPIRED);

    await purgeOrphanedMetadata();

    expect(readSession('orphan')).toBeUndefined();
  });

  it('keeps expired metadata when a cached tree still exists', async () => {
    seedSession('kept', { 'chatbox-0': { bookmarked: true, tags: [] } }, EXPIRED);
    mockStorage.set('tree_kept', { sessionId: 'kept', nodes: [], activeBranchPath: [], lastUpdated: 0 });

    await purgeOrphanedMetadata();

    expect(readSession('kept')).toBeDefined();
  });

  it('keeps orphaned metadata that is within the retention horizon', async () => {
    seedSession('recent-orphan', { 'chatbox-0': { bookmarked: true, tags: [] } }, Date.now() - DAY);

    await purgeOrphanedMetadata();

    expect(readSession('recent-orphan')).toBeDefined();
  });

  it('gives legacy v1 entries a grace period instead of collecting them', async () => {
    // No timestamp on disk — migration stamps "now", so the entry survives.
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      legacy: { 'chatbox-0': { bookmarked: true, tags: [] } },
    });

    await purgeOrphanedMetadata();

    expect(readSession('legacy')?.nodes).toEqual({
      'chatbox-0': { bookmarked: true, tags: [] },
    });
  });

  it('does nothing when the store is empty', async () => {
    await purgeOrphanedMetadata();

    expect(mockLocalStorage.set).not.toHaveBeenCalled();
  });
});
