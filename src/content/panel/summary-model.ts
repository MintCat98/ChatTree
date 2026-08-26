// Gemini Nano readiness for the summary opt-in (issue #165).
//
// Why this lives in the panel and not in the summary queue that actually uses
// the model: Chrome will not start a model download without transient user
// activation, and the background service worker has no way to produce one
// (`messaging-and-storage` skill §8). The settings toggle click is the only
// user gesture in the whole pipeline, so the download has to be kicked off
// from here — the queue then finds the model already available on its next
// drain.
//
// This works only because the Prompt API turned out to be reachable from the
// content script's isolated world — `typeof LanguageModel === 'function'`,
// checked on claude.ai in Chrome 151.0.7922.174 (arm64). That is not true of
// every extension surface, so re-check before moving this code. An older or
// unsupported build has no such global; that is reported as a status, not thrown.

export type SummaryModelStatus =
  | 'ready' // model is loaded and the queue can summarize
  | 'unavailable' // this device/profile cannot run it (create() rejected)
  | 'unsupported'; // no Prompt API in this Chrome at all

// Resolves once the model is usable, reporting download progress (0-100) along
// the way. Never rejects: every failure maps to a status the UI can explain.
//
// MUST be called synchronously from a user-gesture handler.
export async function ensureSummaryModel(
  onProgress: (percent: number) => void,
): Promise<SummaryModelStatus> {
  if (typeof LanguageModel === 'undefined') return 'unsupported';

  try {
    // Deliberately no `await LanguageModel.availability()` gate first. Awaiting
    // anything before create() risks spending the transient activation that
    // gates the download — the one thing this function exists to spend. When
    // the model is already available create() just resolves immediately, and
    // the throwaway session below costs far less than a lost download.
    const session = await LanguageModel.create({
      monitor: (m) => {
        m.addEventListener('downloadprogress', (event) => {
          // Chrome reports `loaded` as a 0-1 fraction.
          const loaded = (event as ProgressEvent).loaded ?? 0;
          onProgress(Math.max(0, Math.min(100, Math.round(loaded * 100))));
        });
      },
    });
    // Nothing to ask it — this call was only ever about triggering the
    // download. Holding the session open would pin the model in memory for a
    // consumer that lives in another context entirely.
    session.destroy();
    return 'ready';
  } catch {
    // 'unavailable' availability, a user-declined download, or no disk space.
    // All of them mean the same thing to the panel: summaries will not appear.
    return 'unavailable';
  }
}
