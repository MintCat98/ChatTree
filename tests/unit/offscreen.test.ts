/**
 * @jest-environment jsdom
 */
// Unit tests for the offscreen embedding document (issue #161): message
// routing, model warm-up, recovery from a failed load, and the idle self-close
// that releases the model.

import { TIMING } from '@shared/constants';
import { MessageType } from '@shared/message-types';

const mockPipeline = jest.fn();

jest.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => mockPipeline(...args),
  env: { backends: { onnx: { wasm: {} } } },
}));

type Listener = (
  msg: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

let listener: Listener;
let closeSpy: jest.SpyInstance;

// A feature-extraction pipeline: callable, resolving to a tensor-like object.
const extractorStub = () => jest.fn(async () => ({ data: Float32Array.from([0.25, -0.5]) }));

const embedMessage = (text: string) => ({
  target: 'offscreen',
  type: MessageType.OFFSCREEN_EMBED,
  text,
});

// Imports the module fresh so its load-time warm-up and idle timer re-run.
async function loadOffscreen(): Promise<void> {
  await jest.isolateModulesAsync(async () => {
    await import('../../src/offscreen/offscreen');
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  closeSpy = jest.spyOn(window, 'close').mockImplementation(() => {});
  mockPipeline.mockResolvedValue(extractorStub());
  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
      onMessage: { addListener: (fn: Listener) => { listener = fn; } },
    },
  };
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('offscreen document — message routing', () => {
  it('answers an embed request with the pooled vector', async () => {
    await loadOffscreen();
    const sendResponse = jest.fn();

    expect(listener(embedMessage('hello'), null, sendResponse)).toBe(true);
    await jest.advanceTimersByTimeAsync(0);

    expect(sendResponse).toHaveBeenCalledWith({ vector: [0.25, -0.5] });
  });

  it('reports a failure instead of leaving the channel open', async () => {
    mockPipeline.mockRejectedValue(new Error('model missing'));
    await loadOffscreen();
    const sendResponse = jest.fn();

    listener(embedMessage('hello'), null, sendResponse);
    await jest.advanceTimersByTimeAsync(0);

    expect(sendResponse).toHaveBeenCalledWith({ error: expect.stringContaining('model missing') });
  });

  it('ignores messages that are not addressed to it', async () => {
    await loadOffscreen();

    expect(listener({ type: MessageType.TREE_READY }, null, jest.fn())).toBeUndefined();
    expect(listener({ target: 'offscreen', type: MessageType.TREE_READY }, null, jest.fn())).toBeUndefined();
  });
});

describe('offscreen document — model loading', () => {
  it('warms the model up once at load, not per message', async () => {
    await loadOffscreen();
    await jest.advanceTimersByTimeAsync(0);

    expect(mockPipeline).toHaveBeenCalledTimes(1);

    // Unrelated traffic reaches this document too; it must not load anything.
    listener({ type: MessageType.TREE_READY }, null, jest.fn());
    listener(embedMessage('hello'), null, jest.fn());
    await jest.advanceTimersByTimeAsync(0);

    expect(mockPipeline).toHaveBeenCalledTimes(1); // reused, not reloaded
  });

  it('retries the load after a failure instead of caching the rejection', async () => {
    mockPipeline.mockRejectedValueOnce(new Error('transient load failure'));
    await loadOffscreen();
    await jest.advanceTimersByTimeAsync(0);

    const sendResponse = jest.fn();
    listener(embedMessage('hello'), null, sendResponse);
    await jest.advanceTimersByTimeAsync(0);

    expect(mockPipeline).toHaveBeenCalledTimes(2); // warm-up failed, request retried
    expect(sendResponse).toHaveBeenCalledWith({ vector: [0.25, -0.5] });
  });
});

describe('offscreen document — idle self-close (issue #161)', () => {
  it('closes itself once idle, releasing the model', async () => {
    await loadOffscreen();

    await jest.advanceTimersByTimeAsync(TIMING.OFFSCREEN_IDLE_MS);

    expect(closeSpy).toHaveBeenCalled();
  });

  it('stays open while embed requests keep arriving', async () => {
    await loadOffscreen();

    for (let i = 0; i < 3; i++) {
      await jest.advanceTimersByTimeAsync(TIMING.OFFSCREEN_IDLE_MS - 1_000);
      listener(embedMessage(`turn-${i}`), null, jest.fn());
      await jest.advanceTimersByTimeAsync(0);
    }

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('restarts the idle window after a request completes, not only when it arrives', async () => {
    // A cold first call can eat most of the idle window on its own.
    let release!: (value: unknown) => void;
    mockPipeline.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    await loadOffscreen();

    listener(embedMessage('hello'), null, jest.fn());
    await jest.advanceTimersByTimeAsync(TIMING.OFFSCREEN_IDLE_MS - 1_000);
    release(extractorStub());
    await jest.advanceTimersByTimeAsync(0);

    // Without the post-completion restart, 1s more would have closed the document.
    await jest.advanceTimersByTimeAsync(2_000);
    expect(closeSpy).not.toHaveBeenCalled();
  });
});
