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

const pending: QueueItem[] = [];
let draining = false;

// Public API — the message handler calls this and returns immediately.
// Fire-and-forget: summaries are a derived cache, so a lost turn is re-sent on
// the next scan / reload.
export function enqueueSummaryTurns(sessionId: string, turns: SummaryTurn[]): void {
  for (const turn of turns) pending.push({ sessionId, turn });
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return; // a single drain loop owns the queue (re-entrancy guard)
  draining = true;
  try {
    const availability = await LanguageModel.availability();
    // Not ready (unavailable / still downloading): drop the backlog rather than
    // spin. Content re-sends as the user keeps scrolling, or on reload once the
    // model is available.
    if (availability === 'unavailable') {
      pending.length = 0;
      return;
    }

    while (pending.length > 0) {
      await processOne(pending.shift()!);
    }
  } catch (err) {
    console.warn('[ChatTree] summary drain failed:', err);
  } finally {
    draining = false;
    // Items enqueued after the loop's last check but before the flag cleared.
    if (pending.length > 0) void drain();
  }
}

async function processOne({ sessionId, turn }: QueueItem): Promise<void> {
  try {
    // Authoritative dedup: skip if already summarized. Survives reload / other
    // tabs, and covers content re-sends after the in-memory sent-set was lost.
    const cache = await getSessionNodeCache(sessionId);
    const entry = cache[turn.nodeId];
    if (entry?.summary && !entry.summaryFallback) return;

    // A fresh session per turn (matches the verified eval pattern) — reusing one
    // session triggers sporadic QuotaExceededError (spike #158).
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
