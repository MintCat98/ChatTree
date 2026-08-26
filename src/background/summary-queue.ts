// Serial, incremental turn-processing queues (issues #160, #161). The content
// script sends completed turns via SUMMARIZE_TURNS; each turn feeds TWO
// independent queues, and each drains its own items ONE AT A TIME so the
// on-device work is spread over time instead of spiking:
//
//   summary   — Prompt API / Gemini Nano, ~2–7 s per turn   (#160)
//   embedding — offscreen transformers.js model             (#161)
//
// The queues are deliberately separate. An embedding is a deterministic signal
// that must not depend on the generative model — #161 rejected LLM-judged
// relevance for exactly that reason — so a Chrome without the Prompt API, and a
// turn that was already summarized on an earlier visit, must still be embedded.
// Sharing one drain would have gated every embedding behind Gemini Nano
// availability and behind the summary dedup.
//
// Results land in the node-cache (#159); rendering them is #165.
//
// Runs in the background service worker: the Prompt API (`LanguageModel`), the
// offscreen document, and the node-cache all live here, and the content script
// must not run heavy work.

import { getSessionNodeCache, setNodeCache } from '@shared/node-cache';
import { summarizeConversation, SUMMARY_SYSTEM_PROMPT } from '@shared/summary';
import { embedViaOffscreen } from '@background/embed';
import { STORAGE_KEYS, TIMING } from '@shared/constants';
import { IDLE_SUMMARY_STATUS, type SummaryQueueStatus } from '@shared/types';

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

// Cap each backlog: when a model is not ready yet the queue is kept (see
// drainSummary) rather than dropped, so it must not grow without bound. Oldest
// turns are evicted first — the user is scrolling forward, so recent turns
// matter more.
const MAX_PENDING_TURNS = 50;

const pendingSummary: QueueItem[] = [];
const pendingEmbed: QueueItem[] = [];
let drainingSummary = false;
let drainingEmbed = false;

// Progress reporting (#165). Without it a slow turn is indistinguishable from a
// broken pipeline: the drain lives in the SW and the panel sees nothing until a
// summary lands, which can be 30s away. Published through storage rather than a
// message because the queue has no tab to answer — one write reaches every open
// tab's panel, and the panel already subscribes to storage for summaries.
//
// Deliberately only written around the ACTUAL summarize loop. The early returns
// above it (no Prompt API, model not ready) must stay silent: reporting
// "working" while nothing can run is the exact confusion this is meant to end.
function publishSummaryStatus(status: SummaryQueueStatus): void {
  // Guarded like panel-store's mirrorToChromeStorage: this also runs at module
  // scope (below), and importing this module must not throw in a context with
  // no `chrome` — the SW always has one, unit tests do not.
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  // Fire-and-forget: a dropped status update costs an indicator frame, and must
  // never interfere with the drain that produced it.
  void chrome.storage.local.set({ [STORAGE_KEYS.SUMMARY_STATUS]: status }).catch(() => {});
}

// Self-heal after SW termination. If the worker dies mid-drain the last status
// written says "active" and no one is left to clear it — the panel would show a
// counter climbing forever. Module scope runs on every cold start, and a cold
// start means no drain is in flight by definition, so clearing here is always
// correct. The SW wakes on the next message from any tab, which during an
// active conversation is seconds away.
publishSummaryStatus(IDLE_SUMMARY_STATUS);

// Public API — the message handler calls this and returns immediately.
// Fire-and-forget: both summaries and embeddings are a derived cache, so a lost
// turn is re-sent on the next scan / reload.
export function enqueueSummaryTurns(sessionId: string, turns: SummaryTurn[]): void {
  for (const turn of turns) {
    pendingSummary.push({ sessionId, turn });
    pendingEmbed.push({ sessionId, turn });
  }
  capBacklog(pendingSummary);
  capBacklog(pendingEmbed);
  void drainSummary();
  void drainEmbed();
}

function capBacklog(queue: QueueItem[]): void {
  if (queue.length > MAX_PENDING_TURNS) queue.splice(0, queue.length - MAX_PENDING_TURNS);
}

async function drainSummary(): Promise<void> {
  if (drainingSummary) return; // a single drain loop owns the queue (re-entrancy guard)
  drainingSummary = true;
  try {
    // Chrome without the Prompt API (pre-138 / unsupported build): the global
    // does not exist at all. Permanent for this browser session — drop the
    // backlog instead of keeping turns that can never be summarized. The
    // embedding queue is untouched: it does not need the Prompt API (#161).
    if (typeof LanguageModel === 'undefined') {
      pendingSummary.length = 0;
      return;
    }

    // Not ready yet ('unavailable' | 'downloadable' | 'downloading'): stop, but
    // KEEP the backlog. The next completed turn calls enqueueSummaryTurns →
    // drainSummary again, which re-checks availability — so a finished download
    // resumes this session instead of waiting for a reload. Calling create()
    // per item here would only burn the backlog on errors.
    const availability = await LanguageModel.availability();
    if (availability !== 'available') return;

    // One run spans the whole backlog, not one turn: `startedAt` is stamped
    // once here so the panel's counter measures how long the AI has been busy
    // overall, which is the question a stuck-looking pipeline raises.
    const startedAt = Date.now();
    while (pendingSummary.length > 0) {
      const item = pendingSummary.shift()!;
      // Published before the await, so the indicator appears at the start of a
      // turn rather than after the first one finishes ~2-7s later.
      publishSummaryStatus({ active: true, startedAt, pending: pendingSummary.length });
      await summarizeOne(item);
    }
  } catch (err) {
    console.warn('[ChatTree] summary drain failed:', err);
  } finally {
    // In the finally so a throw mid-loop still clears the indicator; the early
    // returns above reach this too, where it is a harmless no-op write.
    publishSummaryStatus(IDLE_SUMMARY_STATUS);
    // No re-drain here: the loop's `pendingSummary.length > 0` check and this
    // assignment run in the same microtask (no await between them), so nothing
    // can be enqueued in the gap. Any later push runs enqueueSummaryTurns'
    // own drainSummary() call. Re-draining here would spin forever on the
    // error path.
    drainingSummary = false;
  }
}

// No availability gate and no backlog drop: the offscreen model ships with the
// extension, so it is always "available" in the sense that matters here. A load
// failure surfaces per item in embedOne and the next turn simply retries.
async function drainEmbed(): Promise<void> {
  if (drainingEmbed) return; // re-entrancy guard, as in drainSummary
  drainingEmbed = true;
  try {
    while (pendingEmbed.length > 0) {
      await embedOne(pendingEmbed.shift()!);
    }
  } catch (err) {
    console.warn('[ChatTree] embed drain failed:', err);
  } finally {
    drainingEmbed = false; // see drainSummary's finally for why there is no re-drain
  }
}

async function summarizeOne({ sessionId, turn }: QueueItem): Promise<void> {
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
    // triggers sporadic QuotaExceededError (spike #158 — running-on-device-ai skill §2).
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

async function embedOne({ sessionId, turn }: QueueItem): Promise<void> {
  try {
    // Authoritative dedup, independent of the summary dedup in summarizeOne:
    // a turn summarized before #161 shipped has no embedding yet and must
    // still be backfilled on the next visit.
    const cache = await getSessionNodeCache(sessionId);
    if (cache[turn.nodeId]?.embedding) return;

    // Question and answer are embedded as one vector: relevance is a property
    // of the turn, not of either half.
    const turnText = `User Question: ${turn.question}\n\nLLM Answer: ${turn.answer}`;
    const embedding = await embedViaOffscreen(turnText);
    await setNodeCache(sessionId, turn.nodeId, { embedding });
  } catch (err) {
    // One turn's failure must not stall the queue — swallow and continue.
    console.warn('[ChatTree] embed failed:', turn.nodeId, err);
  }
}
