// Unit tests for metadata-storage helpers (issue #96).

import {
  getSessionMetadata,
  setNodeMetadata,
  clearSessionMetadata,
} from '@shared/metadata-storage';
import { DEFAULT_NODE_METADATA } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';

// ---------------------------------------------------------------------------
// chrome.storage.local mock
// ---------------------------------------------------------------------------

const mockStorage = new Map<string, unknown>();

const mockLocalStorage = {
  get: jest.fn(async (key: string) =>
    mockStorage.has(key) ? { [key]: mockStorage.get(key) } : {},
  ),
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
// getSessionMetadata
// ---------------------------------------------------------------------------

describe('getSessionMetadata', () => {
  it('returns {} when session has no metadata', async () => {
    const result = await getSessionMetadata('sess-1');
    expect(result).toEqual({});
  });

  it('returns only the requested session data', async () => {
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      'sess-1': { 'chatbox-0': { bookmarked: true, tags: ['important'] } },
      'sess-2': { 'chatbox-0': { bookmarked: false, tags: [] } },
    });
    const result = await getSessionMetadata('sess-1');
    expect(result).toEqual({ 'chatbox-0': { bookmarked: true, tags: ['important'] } });
  });
});

// ---------------------------------------------------------------------------
// setNodeMetadata
// ---------------------------------------------------------------------------

describe('setNodeMetadata', () => {
  it('creates a new node entry with defaults merged with patch', async () => {
    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    const store = mockStorage.get(STORAGE_KEYS.NODE_METADATA) as Record<string, unknown>;
    expect(store['sess-1']).toEqual({
      'chatbox-0': { bookmarked: true, tags: [] },
    });
  });

  it('patches an existing entry without overwriting unchanged fields', async () => {
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      'sess-1': { 'chatbox-0': { bookmarked: false, tags: ['a', 'b'] } },
    });

    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    const store = mockStorage.get(STORAGE_KEYS.NODE_METADATA) as Record<string, unknown>;
    expect((store['sess-1'] as Record<string, unknown>)['chatbox-0']).toEqual({
      bookmarked: true,
      tags: ['a', 'b'],
    });
  });

  it('does not affect other nodes in the same session', async () => {
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      'sess-1': {
        'chatbox-0': { bookmarked: false, tags: [] },
        'chatbox-1': { bookmarked: true, tags: ['x'] },
      },
    });

    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    const store = mockStorage.get(STORAGE_KEYS.NODE_METADATA) as Record<string, unknown>;
    expect((store['sess-1'] as Record<string, unknown>)['chatbox-1']).toEqual({
      bookmarked: true,
      tags: ['x'],
    });
  });

  it('does not affect other sessions', async () => {
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      'sess-2': { 'chatbox-0': { bookmarked: true, tags: ['keep'] } },
    });

    await setNodeMetadata('sess-1', 'chatbox-0', { bookmarked: true });

    const store = mockStorage.get(STORAGE_KEYS.NODE_METADATA) as Record<string, unknown>;
    expect((store['sess-2'] as Record<string, unknown>)['chatbox-0']).toEqual({
      bookmarked: true,
      tags: ['keep'],
    });
  });

  it('DEFAULT_NODE_METADATA is the base when no prior entry exists', async () => {
    await setNodeMetadata('sess-1', 'chatbox-0', {});

    const store = mockStorage.get(STORAGE_KEYS.NODE_METADATA) as Record<string, unknown>;
    expect((store['sess-1'] as Record<string, unknown>)['chatbox-0']).toEqual(DEFAULT_NODE_METADATA);
  });
});

// ---------------------------------------------------------------------------
// clearSessionMetadata
// ---------------------------------------------------------------------------

describe('clearSessionMetadata', () => {
  it('removes the session entry from the store', async () => {
    mockStorage.set(STORAGE_KEYS.NODE_METADATA, {
      'sess-1': { 'chatbox-0': { bookmarked: true, tags: [] } },
      'sess-2': { 'chatbox-0': { bookmarked: false, tags: [] } },
    });

    await clearSessionMetadata('sess-1');

    const store = mockStorage.get(STORAGE_KEYS.NODE_METADATA) as Record<string, unknown>;
    expect(store).not.toHaveProperty('sess-1');
    expect(store).toHaveProperty('sess-2');
  });

  it('does not throw when the session has no metadata', async () => {
    await expect(clearSessionMetadata('nonexistent')).resolves.toBeUndefined();
  });
});
