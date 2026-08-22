// Unit tests for the offscreen embedding bridge (issue #161): document
// lifecycle, the response contract, and the timeout that stops a wedged
// offscreen document from stalling the embedding drain for the whole session.

import { embedViaOffscreen } from '@background/embed';
import { cosineSimilarity } from '@background/relevance';
import { TIMING } from '@shared/constants';
import { MessageType } from '@shared/message-types';

const hasDocument = jest.fn();
const createDocument = jest.fn();
const closeDocument = jest.fn();
const sendMessage = jest.fn();

// A promise that never settles — the offscreen document that stops replying.
const wedged = () => new Promise<never>(() => {});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  hasDocument.mockResolvedValue(false);
  createDocument.mockResolvedValue(undefined);
  closeDocument.mockResolvedValue(undefined);
  sendMessage.mockResolvedValue({ vector: [0.1, 0.2, 0.3] });
  (globalThis as Record<string, unknown>).chrome = {
    offscreen: { hasDocument, createDocument, closeDocument },
    runtime: { sendMessage },
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('embedViaOffscreen — document lifecycle', () => {
  it('creates the offscreen document and returns the vector', async () => {
    await expect(embedViaOffscreen('hello')).resolves.toEqual([0.1, 0.2, 0.3]);

    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      target: 'offscreen',
      type: MessageType.OFFSCREEN_EMBED,
      text: 'hello',
    });
  });

  it('reuses an existing document', async () => {
    hasDocument.mockResolvedValue(true);

    await embedViaOffscreen('hello');

    expect(createDocument).not.toHaveBeenCalled();
  });
});

describe('embedViaOffscreen — stored precision (issue #161)', () => {
  it('rounds the vector to the stored precision', async () => {
    sendMessage.mockResolvedValue({ vector: [0.05123456789, -0.98765432101, 0] });

    await expect(embedViaOffscreen('hello')).resolves.toEqual([0.0512, -0.9877, 0]);
  });

  it('keeps cosine similarity within 1e-3 of the full-precision vectors', async () => {
    const random = () => Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    const [rawA, rawB] = [random(), random()];

    sendMessage.mockResolvedValueOnce({ vector: rawA }).mockResolvedValueOnce({ vector: rawB });
    const storedA = await embedViaOffscreen('a');
    const storedB = await embedViaOffscreen('b');

    const exact = cosineSimilarity(rawA, rawB)!;
    expect(cosineSimilarity(storedA, storedB)!).toBeCloseTo(exact, 3);
  });

  it('shrinks the JSON footprint of a 384-dim vector by more than half', async () => {
    const raw = Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    sendMessage.mockResolvedValue({ vector: raw });

    const stored = await embedViaOffscreen('hello');

    expect(JSON.stringify(stored).length).toBeLessThan(JSON.stringify(raw).length / 2);
  });
});

describe('embedViaOffscreen — failures', () => {
  it('throws the error reported by the offscreen document', async () => {
    sendMessage.mockResolvedValue({ error: 'model load failed' });

    await expect(embedViaOffscreen('hello')).rejects.toThrow('model load failed');
  });

  it('throws when the offscreen document answers with nothing', async () => {
    sendMessage.mockResolvedValue(undefined);

    await expect(embedViaOffscreen('hello')).rejects.toThrow('no response');
  });

  it('keeps the document on an ordinary failure — only a stall is unrecoverable', async () => {
    sendMessage.mockResolvedValue({ error: 'model load failed' });

    await expect(embedViaOffscreen('hello')).rejects.toThrow();

    expect(closeDocument).not.toHaveBeenCalled();
  });
});

describe('embedViaOffscreen — timeout (issue #161)', () => {
  // The expectation is attached BEFORE the timers advance: the rejection lands
  // while advanceTimersByTimeAsync is running, and an unattached one would be
  // reported as an unhandled rejection instead of failing the assertion.
  it('rejects instead of awaiting a document that never replies', async () => {
    sendMessage.mockReturnValue(wedged());

    const rejects = expect(embedViaOffscreen('hello')).rejects.toThrow('offscreen embed timed out');
    await jest.advanceTimersByTimeAsync(TIMING.EMBED_TIMEOUT_MS);

    await rejects;
  });

  it('tears down the wedged document so the next call starts fresh', async () => {
    sendMessage.mockReturnValue(wedged());
    hasDocument.mockResolvedValueOnce(false).mockResolvedValue(true);

    const rejects = expect(embedViaOffscreen('hello')).rejects.toThrow();
    await jest.advanceTimersByTimeAsync(TIMING.EMBED_TIMEOUT_MS);
    await rejects;

    expect(closeDocument).toHaveBeenCalledTimes(1);
  });

  it('does not reject just before the deadline', async () => {
    sendMessage.mockReturnValue(wedged());

    const pending = embedViaOffscreen('hello');
    const settled = jest.fn();
    void pending.then(settled, settled);

    await jest.advanceTimersByTimeAsync(TIMING.EMBED_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();

    // Leave nothing pending for the next test.
    const rejects = expect(pending).rejects.toThrow();
    await jest.advanceTimersByTimeAsync(1);
    await rejects;
  });

  it('clears the timer on success — a live timer would keep the SW awake', async () => {
    await embedViaOffscreen('hello');

    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the timer when the document reports an error', async () => {
    sendMessage.mockResolvedValue({ error: 'model load failed' });

    await expect(embedViaOffscreen('hello')).rejects.toThrow();

    expect(jest.getTimerCount()).toBe(0);
  });
});
