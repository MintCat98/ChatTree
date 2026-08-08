// Unit tests for the serial summary queue (issue #160): dedup against the
// node-cache, availability gating / backlog retention, and drain termination.
//
// The queue keeps module-level state (`pending`, `draining`), so every case
// re-imports the module through jest.isolateModulesAsync.

import type { NodeCacheEntry } from '@shared/types';
import type { NodeSummary } from '@shared/summary';
import { NODE_CACHE_KEY_PREFIX } from '@shared/constants';

jest.mock('@background/embed');
import { embedViaOffscreen } from '@background/embed';
const mockEmbed = embedViaOffscreen as jest.MockedFunction<typeof embedViaOffscreen>;

type Queue = typeof import('@background/summary-queue');

const SUMMARY: NodeSummary = { keyword: 'kw', question: 'q?', answer: 'a.' };
const MODEL_JSON = JSON.stringify(SUMMARY);

// --- chrome.storage.local fake (same shape as node-cache.test.ts) ---

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
    const keys = Array.isArray(key) ? key : [key];
    keys.forEach((k) => mockStorage.delete(k));
  }),
};

function seedCache(sessionId: string, nodes: Record<string, NodeCacheEntry>): void {
  mockStorage.set(`${NODE_CACHE_KEY_PREFIX}${sessionId}`, nodes);
}

function readCache(sessionId: string): Record<string, NodeCacheEntry> {
  return (mockStorage.get(`${NODE_CACHE_KEY_PREFIX}${sessionId}`) ?? {}) as Record<
    string,
    NodeCacheEntry
  >;
}

// --- LanguageModel fake ---

interface ModelStub {
  availability: jest.Mock;
  create: jest.Mock;
  prompts: string[];
}

function installModel(
  availability: LanguageModelAvailability,
  reply: string | Error = MODEL_JSON,
): ModelStub {
  const prompts: string[] = [];
  const stub: ModelStub = {
    availability: jest.fn(async () => availability),
    create: jest.fn(async () => {
      const child = {
        prompt: jest.fn(async (input: string) => {
          prompts.push(input);
          if (reply instanceof Error) throw reply;
          return reply;
        }),
        destroy: jest.fn(),
      };
      return {
        prompt: jest.fn(),
        clone: jest.fn(async () => child),
        destroy: jest.fn(),
      };
    }),
    prompts,
  };
  (globalThis as Record<string, unknown>).LanguageModel = stub;
  return stub;
}

// Loads a fresh copy of the queue module (clean pending/draining state).
async function loadQueue(): Promise<Queue> {
  let mod!: Queue;
  await jest.isolateModulesAsync(async () => {
    mod = await import('@background/summary-queue');
  });
  return mod;
}

// The queue is fire-and-forget: enqueue returns before the async drain runs.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const turn = (nodeId: string) => ({ nodeId, question: `q-${nodeId}`, answer: `a-${nodeId}` });

beforeEach(() => {
  mockStorage.clear();
  jest.clearAllMocks();
  (globalThis as Record<string, unknown>).chrome = { storage: { local: mockLocalStorage } };
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockEmbed.mockReset();
  mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);
});

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).LanguageModel;
});

describe('enqueueSummaryTurns — happy path', () => {
  it('summarizes a turn and writes it to the node-cache', async () => {
    const model = installModel('available');
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(model.create).toHaveBeenCalledTimes(1);
    expect(readCache('sess-1')['chatbox-0']).toEqual({
      summary: SUMMARY,
      summaryFallback: false,
      embedding: [0.1, 0.2, 0.3],
    });
  });

  it('drains turns one at a time', async () => {
    const model = installModel('available');
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0'), turn('chatbox-2')]);
    await settle();

    expect(model.create).toHaveBeenCalledTimes(2);
    expect(Object.keys(readCache('sess-1'))).toEqual(['chatbox-0', 'chatbox-2']);
  });

  it('flags a truncated fallback when the model never returns valid JSON', async () => {
    installModel('available', new Error('QuotaExceededError'));
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    const entry = readCache('sess-1')['chatbox-0'];
    expect(entry.summaryFallback).toBe(true);
    expect(entry.summary?.answer).toBe('a-chatbox-0');
  });
});

describe('dedup against the node-cache', () => {
  it('skips a turn that already has a real summary', async () => {
    seedCache('sess-1', { 'chatbox-0': { summary: SUMMARY } });
    const model = installModel('available');
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(model.create).not.toHaveBeenCalled();
  });

  it('re-summarizes a turn whose stored summary was a truncated fallback', async () => {
    seedCache('sess-1', { 'chatbox-0': { summary: SUMMARY, summaryFallback: true } });
    const model = installModel('available');
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(model.create).toHaveBeenCalledTimes(1);
    expect(readCache('sess-1')['chatbox-0'].summaryFallback).toBe(false);
  });

  it('keeps a sibling field written by another pipeline (#161)', async () => {
    seedCache('sess-1', { 'chatbox-0': { embedding: [0.42, 0.1] } });
    installModel('available');
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(readCache('sess-1')['chatbox-0'].embedding).toEqual([0.42, 0.1]);
  });
});

describe('availability gating', () => {
  it.each(['downloadable', 'downloading', 'unavailable'] as const)(
    'does not create a session when availability is %s',
    async (availability) => {
      const model = installModel(availability);
      const queue = await loadQueue();

      queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
      await settle();

      expect(model.create).not.toHaveBeenCalled();
      expect(readCache('sess-1')).toEqual({});
    },
  );

  it('keeps the backlog and resumes once the model becomes available', async () => {
    // The content script marks a node as sent for the whole visit, so dropping
    // the backlog here would lose those turns until a reload.
    const model = installModel('downloading');
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0'), turn('chatbox-2')]);
    await settle();
    expect(model.create).not.toHaveBeenCalled();

    // Download finished; the next completed turn re-triggers the drain.
    model.availability.mockResolvedValue('available');
    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-4')]);
    await settle();

    expect(Object.keys(readCache('sess-1'))).toEqual(['chatbox-0', 'chatbox-2', 'chatbox-4']);
  });

  it('caps the retained backlog, keeping the most recent turns', async () => {
    const model = installModel('unavailable');
    const queue = await loadQueue();

    for (let i = 0; i < 60; i++) queue.enqueueSummaryTurns('sess-1', [turn(`chatbox-${i}`)]);
    await settle();

    model.availability.mockResolvedValue('available');
    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-60')]);
    await settle();

    const ids = Object.keys(readCache('sess-1'));
    expect(ids).toHaveLength(50);
    expect(ids).toContain('chatbox-60');
    expect(ids).not.toContain('chatbox-0'); // oldest evicted
  });
});

describe('drain termination', () => {
  it('stops instead of spinning when LanguageModel does not exist', async () => {
    // Pre-138 / unsupported Chrome: the global is missing entirely. A drain
    // that re-entered itself on the error path would loop forever here.
    delete (globalThis as Record<string, unknown>).LanguageModel;
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(readCache('sess-1')).toEqual({});
    // Backlog dropped, so a later enqueue does not replay the dead turns.
    const model = installModel('available');
    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-2')]);
    await settle();

    expect(model.create).toHaveBeenCalledTimes(1);
    expect(Object.keys(readCache('sess-1'))).toEqual(['chatbox-2']);
  });

  it('stops when availability() itself rejects', async () => {
    const model = installModel('available');
    model.availability.mockRejectedValue(new Error('model host crashed'));
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(model.availability).toHaveBeenCalledTimes(1);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('keeps draining after one turn throws', async () => {
    const model = installModel('available');
    model.create
      .mockRejectedValueOnce(new Error('session create failed'))
      .mockResolvedValueOnce({
        prompt: jest.fn(),
        clone: jest.fn(async () => ({
          prompt: jest.fn(async () => MODEL_JSON),
          destroy: jest.fn(),
        })),
        destroy: jest.fn(),
      });
    const queue = await loadQueue();

    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0'), turn('chatbox-2')]);
    await settle();

    expect(Object.keys(readCache('sess-1'))).toEqual(['chatbox-0', 'chatbox-2']);
    expect(readCache('sess-1')['chatbox-0'].summary).toBeUndefined();
    expect(readCache('sess-1')['chatbox-2'].summary).toEqual(SUMMARY);
  });
});

describe('embedding (#161)', () => {
  it('computes and stores an embedding for a fresh turn', async () => {
    installModel('available');
    const queue = await loadQueue();
    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.stringContaining('User Question:')   // question+answer 결합 텍스트
    );
    expect(readCache('sess-1')['chatbox-0'].embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('does not recompute when an embedding already exists (dedup)', async () => {
    seedCache('sess-1', { 'chatbox-0': { embedding: [0.42, 0.1] } });
    installModel('available');
    const queue = await loadQueue();
    queue.enqueueSummaryTurns('sess-1', [turn('chatbox-0')]);
    await settle();

    expect(mockEmbed).not.toHaveBeenCalled();
    expect(readCache('sess-1')['chatbox-0'].embedding).toEqual([0.42, 0.1]);
  });
});