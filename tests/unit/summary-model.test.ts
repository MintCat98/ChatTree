// Unit tests for the Gemini Nano readiness check behind the summary opt-in
// (issue #165). ensureSummaryModel runs from the settings toggle's click — the
// pipeline's only user gesture — so its contract is: never reject, always
// resolve to a status the panel can explain, and never hold the session open.

import { ensureSummaryModel } from '@content/panel/summary-model';

type Monitor = { addEventListener: (type: string, fn: (e: unknown) => void) => void };

const g = global as unknown as { LanguageModel?: unknown };

function setLanguageModel(
  create: (options?: { monitor?: (m: Monitor) => void }) => Promise<{ destroy: () => void }>,
): void {
  g.LanguageModel = { create, availability: jest.fn() };
}

afterEach(() => {
  delete g.LanguageModel;
  jest.clearAllMocks();
});

describe('ensureSummaryModel — status mapping', () => {
  it('reports unsupported when the Prompt API global is absent', async () => {
    // Pre-138 / unsupported build: the global does not exist at all.
    delete g.LanguageModel;

    expect(await ensureSummaryModel(jest.fn())).toBe('unsupported');
  });

  it('reports ready once create() resolves', async () => {
    setLanguageModel(async () => ({ destroy: jest.fn() }));

    expect(await ensureSummaryModel(jest.fn())).toBe('ready');
  });

  it('reports unavailable instead of rejecting when create() throws', async () => {
    // 'unavailable' availability, a declined download, or no disk space — the
    // panel treats all three the same, and none may surface as a rejection.
    setLanguageModel(async () => {
      throw new Error('NotSupportedError');
    });

    await expect(ensureSummaryModel(jest.fn())).resolves.toBe('unavailable');
  });
});

describe('ensureSummaryModel — session lifetime', () => {
  it('destroys the throwaway session it created', async () => {
    // The session exists only to spend the user gesture; the actual consumer
    // is the summary queue in the service worker. Holding it open would pin
    // the model in memory for a context that never prompts it.
    const destroy = jest.fn();
    setLanguageModel(async () => ({ destroy }));

    await ensureSummaryModel(jest.fn());

    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

describe('ensureSummaryModel — download progress', () => {
  it('forwards downloadprogress as a 0-100 percentage', async () => {
    // Chrome reports `loaded` as a 0-1 fraction; the UI shows whole percent.
    setLanguageModel(async (options) => {
      options?.monitor?.({
        addEventListener: (type, fn) => {
          if (type === 'downloadprogress') {
            fn({ loaded: 0 });
            fn({ loaded: 0.425 });
            fn({ loaded: 1 });
          }
        },
      });
      return { destroy: jest.fn() };
    });

    const onProgress = jest.fn();
    await ensureSummaryModel(onProgress);

    expect(onProgress.mock.calls.map(([p]) => p)).toEqual([0, 43, 100]);
  });

  it('clamps a progress value outside 0-1 instead of rendering nonsense', async () => {
    setLanguageModel(async (options) => {
      options?.monitor?.({
        addEventListener: (_type, fn) => {
          fn({ loaded: -0.5 });
          fn({ loaded: 2 });
        },
      });
      return { destroy: jest.fn() };
    });

    const onProgress = jest.fn();
    await ensureSummaryModel(onProgress);

    expect(onProgress.mock.calls.map(([p]) => p)).toEqual([0, 100]);
  });

  it('does not report progress when the model is already downloaded', async () => {
    // Already-available create() resolves without emitting any event, which is
    // what keeps the hint quiet for users who opted in before.
    setLanguageModel(async () => ({ destroy: jest.fn() }));

    const onProgress = jest.fn();
    await ensureSummaryModel(onProgress);

    expect(onProgress).not.toHaveBeenCalled();
  });
});
