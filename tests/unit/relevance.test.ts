import { cosineSimilarity, getRelevance } from '@background/relevance';
import type { NodeCacheEntry } from '@shared/types';
import { NODE_CACHE_KEY_PREFIX } from '@shared/constants';

// --- chrome.storage.local mock (node-cache.test.ts와 동일 패턴) ---
const mockStorage = new Map<string, unknown>();
const mockLocalStorage = {
  get: jest.fn(async (key: string | string[] | null) => {
    if (key === null) return Object.fromEntries(mockStorage);
    const keys = Array.isArray(key) ? key : [key];
    const result: Record<string, unknown> = {};
    for (const k of keys) if (mockStorage.has(k)) result[k] = mockStorage.get(k);
    return result;
  }),
  set: jest.fn(),
  remove: jest.fn(),
};

function seedSession(sessionId: string, nodes: Record<string, NodeCacheEntry>): void {
  mockStorage.set(`${NODE_CACHE_KEY_PREFIX}${sessionId}`, nodes);
}

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
  (global as unknown as { chrome: typeof chrome }).chrome = {
    storage: { local: mockLocalStorage },
  } as unknown as typeof chrome;
});

// --- 순수 함수: mock 없이 값만 검증 ---
describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });
  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });
  it('returns null on length mismatch', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBeNull();
  });
  it('returns null for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBeNull();
  });
  it('returns null when a vector has no direction (all zeros)', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBeNull();
  });
});

// Cache fetching + calculation
describe('getRelevance', () => {
  it("computes cosine between two nodes' embeddings", async () => {
    seedSession('sess-1', {
      'chatbox-0': { embedding: [1, 0] },
      'chatbox-1': { embedding: [0, 1] },
    });
    expect(await getRelevance('sess-1', 'chatbox-0', 'chatbox-1')).toBeCloseTo(0);
  });
  it('returns null when a node has no embedding', async () => {
    seedSession('sess-1', {
      'chatbox-0': { embedding: [1, 0] },
      'chatbox-1': { summary: { keyword: 'k', question: 'q', answer: 'a' } },
    });
    expect(await getRelevance('sess-1', 'chatbox-0', 'chatbox-1')).toBeNull();
  });
  it('returns null when a node is absent from the cache', async () => {
    seedSession('sess-1', { 'chatbox-0': { embedding: [1, 0] } });
    expect(await getRelevance('sess-1', 'chatbox-0', 'missing')).toBeNull();
  });
  it('returns null when the session has no cache', async () => {
    expect(await getRelevance('empty', 'chatbox-0', 'chatbox-1')).toBeNull();
  });
});
