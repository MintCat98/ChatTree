// Serial, incremental summary queue (issue #160). The content script sends
// completed turns via SUMMARIZE_TURNS; this drains them ONE AT A TIME so the
// on-device summarization (~2–7 s each) is spread over time instead of spiking.
// Results land in the node-cache (#159); rendering them is #165.
//
// Runs in the background service worker: the Prompt API (`LanguageModel`) and
// the node-cache both live here, and the content script must not run heavy work.

import { getSessionNodeCache, setNodeCache } from '@shared/node-cache';
import { summarizeConversation, SUMMARY_SYSTEM_PROMPT } from '@shared/summary';
import { TIMING } from '@shared/constants';

// One completed turn to summarize. `answer` is guaranteed non-empty by the
// content-side filter before it is sent.
export interface SummaryTurn {
  nodeId: string;
  question: string;
  answer: string;
}

interface QueueItem {
  sessionId: string;
  turn: SummaryTurn;
}

// Cap the backlog: when the model is not ready yet the queue is kept (see
// drain) rather than dropped, so it must not grow without bound. Oldest turns
// are evicted first — the user is scrolling forward, so recent turns matter more.
const MAX_PENDING_TURNS = 50;

const pending: QueueItem[] = [];
let draining = false;

// Public API — the message handler calls this and returns immediately.
// Fire-and-forget: summaries are a derived cache, so a lost turn is re-sent on
// the next scan / reload.
export function enqueueSummaryTurns(sessionId: string, turns: SummaryTurn[]): void {
  for (const turn of turns) pending.push({ sessionId, turn });
  if (pending.length > MAX_PENDING_TURNS) pending.splice(0, pending.length - MAX_PENDING_TURNS);
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return; // a single drain loop owns the queue (re-entrancy guard)
  draining = true;
  try {
    // Chrome without the Prompt API (pre-138 / unsupported build): the global
    // does not exist at all. Permanent for this browser session — drop the
    // backlog instead of keeping turns that can never be summarized.
    if (typeof LanguageModel === 'undefined') {
      pending.length = 0;
      return;
    }

    // Not ready yet ('unavailable' | 'downloadable' | 'downloading'): stop, but
    // KEEP the backlog. The next completed turn calls enqueueSummaryTurns →
    // drain again, which re-checks availability — so a finished download
    // resumes this session instead of waiting for a reload. Calling create()
    // per item here would only burn the backlog on errors.
    const availability = await LanguageModel.availability();
    if (availability !== 'available') return;

    while (pending.length > 0) {
      await processOne(pending.shift()!);
    }
  } catch (err) {
    console.warn('[ChatTree] summary drain failed:', err);
  } finally {
    // No re-drain here: the loop's `pending.length > 0` check and this
    // assignment run in the same microtask (no await between them), so nothing
    // can be enqueued in the gap. Any later push runs enqueueSummaryTurns'
    // own drain() call. Re-draining here would spin forever on the error path.
    draining = false;
  }
}

async function processOne({ sessionId, turn }: QueueItem): Promise<void> {
  try {
    // Authoritative dedup: skip if already summarized. Survives reload / other
    // tabs, and covers content re-sends after the in-memory sent-set was lost.
    // A truncated fallback entry IS re-summarized — but only on a later visit:
    // the content script's per-session sent-set will not re-send this nodeId
    // before then. That granularity is deliberate; retrying immediately would
    // feed the same input to the same model and fail the same way.
    const cache = await getSessionNodeCache(sessionId);
    const entry = cache[turn.nodeId];
    if (entry?.summary && !entry.summaryFallback) return;

    // Base session per turn: never prompted directly. summarizeConversation
    // clones it per attempt, because reusing one session ACROSS attempts
    // triggers sporadic QuotaExceededError (spike #158, it#5).
    const session = await LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SUMMARY_SYSTEM_PROMPT }],
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMING.SUMMARY_TIMEOUT_MS);
    try {
      const { ok, summary } = await summarizeConversation(
        session,
        turn.question,
        turn.answer,
        controller.signal
      );
      // summarizeConversation always returns a summary (truncated fallback on
      // failure), so one entry is written per turn and dedup won't re-run it.
      if (summary) await setNodeCache(sessionId, turn.nodeId, { summary, summaryFallback: !ok });
    } finally {
      clearTimeout(timer);
      session.destroy();
    }
  } catch (err) {
    // One turn's failure must not stall the queue — swallow and continue.
    console.warn('[ChatTree] summarize failed:', turn.nodeId, err);
  }
}
