---
name: messaging-and-storage
description: Extension message contracts and flow between Content Script, Background service worker, and Panel, plus the chrome.storage.local tree cache and per-node metadata (bookmarks, tags, hidden) - hydration on conversation entry, the metadata read/write API, and retention/purge policy. Use when adding or changing message types, working on src/background/ or session-store, reading or writing node metadata, or changing cache, hydration, or retention behavior.
---

# Messaging & Storage

> **Purpose:** How the Content Script, Background Service Worker, and Panel
> communicate, and how tree data is cached and retained in `chrome.storage.local`.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Chrome Extension                       │
│                                                          │
│  ┌─────────────────┐      ┌─────────────────────────┐    │
│  │  Content Script  │────▶│   Service Worker         │    │
│  │  (claude.ai)     │◀────│   (Background)           │    │
│  │                  │      │                          │    │
│  │  - DOM Observer  │      │  - Message relay         │    │
│  │  - Chatbox Track │      │  - Tree cache            │    │
│  │  - Scroll Nav    │      │    (session-store.ts)    │    │
│  │  - UI Injector   │      │  - Retention purge       │    │
│  └────────┬─────────┘      └──────────┬───────────────┘    │
│           │                           │                    │
│           │          ┌────────────────▼──────────┐         │
│           │          │      chrome.storage.local  │         │
│           │          │  (tree_<sessionId> cache)  │         │
│           │          └───────────────────────────┘         │
│  ┌────────▼─────────────────────────────────────────┐      │
│  │        UI Panel (Floating, Shadow DOM)            │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

- Background modules: `src/background/index.ts`, `message-handler.ts`, `session-store.ts`
- Content ↔ Background bridge: `src/content/message-bridge.ts`
- All communication uses `chrome.runtime.sendMessage` (MV3 standard). The
  Content Script never calls external services directly.

---

## 2. Message Types

> Full definitions: `src/shared/message-types.ts`
> **Do not use raw string literals — use the enum.**

| `type` | Direction | payload | Description |
|--------|------|---------|------|
| `CHATBOX_ADDED` | Content → BG | — | New chatbox DOM detected |
| `BRANCH_CHANGED` | Content → BG | `{ navId, sessionId }` | Branch switch detected |
| `CHAT_PAGE_ENTERED` | Content → BG | `{ url }` | Entered a new conversation URL |
| `ACTIVE_NODE_CHANGED` | Content → BG | `{ navId }` | Active node in viewport changed |
| `TREE_UPDATE` | Content → BG | `{ nodes, sessionId }` | Request full tree recalculation |
| `SUMMARIZE_TURNS` | Content → BG | `{ sessionId, turns: [{ nodeId, question, answer }] }` | Enqueue completed turns for summarization **and** embedding — fire-and-forget (§8) |
| `GET_STORED_TREE` | Content → BG | `{ sessionId }` | Look up stored tree — request/response, for hydration (#152) |
| `GET_RELEVANCE` | Content/Panel → BG | `{ sessionId, nodeIdA, nodeIdB }` | Cosine similarity of two turns' embeddings — request/response, responds `{ relevance: number \| null }`; `null` when either embedding is missing (#189) |
| `OFFSCREEN_EMBED` | BG → offscreen | `{ target: 'offscreen', text }` | Embed one turn — request/response, responds `{ vector }` or `{ error }` (#161). Addressed by `target`, not routed through `message-handler` |
| `TREE_READY` | BG → Content/Panel | `{ tree }` | Push after tree data is ready |
| `SCROLL_TO_NODE` | Panel → Content | `{ navId }` | Scroll request — relayed, but **no sender today**: the panel runs in the content-script context and calls `scrollToNode()` directly |
| `CLEAR_TREE_CACHE` | Panel → BG | — | Remove all cached trees — request/response, responds `{ ok }` (#153) |
| `SETTINGS_CHANGE` | Popup → BG | `{ settings }` | Settings changed |

**Node metadata has no message type.** The panel reads and writes
`chrome.storage.local` directly (§7) — content scripts have `chrome.storage`
access, so routing it through Background would buy nothing.

---

## 3. Main Flow (tree update)

```
DOM change detected
     │
     ▼
Content Script: chatbox-tracker.mergeMountedNodes()
     │  ChatboxNode[] created (accumulated across scans —
     │  see ../analyzing-claude-dom/SKILL.md §3)
     ▼
Content Script → Background: { type: 'TREE_UPDATE', nodes: ChatboxNode[], sessionId }
     │
     ▼
Background: session-store.updateTree(sessionId, nodes)
     │
     ▼
Background → Content Script: { type: 'TREE_READY', tree: TreeData }
     │
     ▼
UI Panel: TreeMapCanvas re-renders
```

> No summarize or embed step exists in **this** flow. Derived content travels on
> its own message (`SUMMARIZE_TURNS`) and lands in a different store — see §8.

---

## 4. Hydration on Conversation Entry (issue #152)

```
observer.startObserving()
     │
     ▼
Content Script → Background: { type: 'GET_STORED_TREE', sessionId }   ← request/response
     │
     ▼
Background: session-store.getTree(sessionId)  →  responds { tree: TreeData | null }
     │
     ▼
Content Script: chatbox-tracker.seedNodeCache(tree.nodes)
     │  DOM-scanned entries always win; stale seeded turns are dropped
     │  by mergeMountedNodes' divergence rule as scanning proceeds
     ▼
Tree dispatched with the full accumulated node list
```

The stored tree survives new windows, tab reloads, and browser restarts
(`chrome.storage.local`, issue #153), so a long conversation no longer starts
truncated. `CHAT_PAGE_ENTERED` must **not** clear the stored tree — it is the
hydration source.

---

## 5. Retention & Cache Clear (issue #153)

`storage.local` never self-cleans, so the Background SW bounds accumulation:

- **Daily purge alarm** (`tree-cache-purge`, `chrome.alarms`, 24 h) + once on
  `chrome.runtime.onStartup`: removes trees whose `lastUpdated` is older than
  `UserSettings.cacheRetentionDays` (default 30). Every `updateTree` refreshes
  `lastUpdated`, so the horizon means "days since last visit/update".
- **Orphaned-metadata GC** runs right after the tree purge (order matters — the
  orphan check must see the post-purge tree set): node metadata (bookmarks,
  tags, hidden — issue #96) for sessions with **no cached tree** and untouched for
  `METADATA_RETENTION_DAYS` (180) is dropped. Metadata is user data, not a
  rebuildable cache — it re-attaches on revisit via deterministic position-based
  node IDs — hence the far more conservative horizon than the tree cache.
- **Quota safety net**: if a tree write hits the 10 MB `storage.local` quota,
  `updateTree` evicts the oldest quarter of cached trees (never the one being
  written) and retries once.
- **Manual clear** (`CLEAR_TREE_CACHE`, Panel → BG request/response): removes
  all `tree_*` keys, leaves node metadata untouched; the panel then calls
  `observer.rescanFromDom()` so the current conversation re-renders from the
  live DOM instead of going blank.

---

## 6. Storage Keys

| Key | Owner | Contents |
|-----|-------|----------|
| `tree_<sessionId>` | Background (`session-store.ts`) | Cached `TreeData` per conversation — subject to retention purge |
| `nodeCache_<sessionId>` | `src/shared/node-cache.ts` | Computed per-node data — `summary` (#160), `embedding` (#161). Rebuildable; purged as soon as its `tree_` key is gone. Read back by the panel via `getSessionSummaries` — §9 |
| `nodeMetadata` | `src/shared/metadata-storage.ts` | User data, **not** a rebuildable cache — 180-day orphan GC only |
| `summaryStatus` | `src/background/summary-queue.ts` | `SummaryQueueStatus` — live drain state, SW → panel. Ephemeral; cleared on SW cold start (§9) |
| `userSettings` | Panel store `mirrorToChromeStorage` | `UserSettings` — `chrome.storage.local`, no localStorage fallback |

**`setNodeCache` writes are serialized** through a module-level promise chain.
It reads the session map, merges the patch, and writes it back — with an `await`
in between, so two concurrent callers would both read the pre-write state and
the second write would drop the first one's field. The summary and embedding
drains (§8) do exactly that to the same entry.

**It also defends the 10 MB quota**, which this cache shares with `tree_` keys:
on a failed write it purges orphaned node caches, retries, then evicts the
oldest quarter of *other* sessions' caches and retries once more before
throwing. Orphans go first because a live cache costs a full model re-run to
rebuild. See [running-on-device-ai](../running-on-device-ai/SKILL.md) §6 for the
size budget that makes this necessary.

---

## 7. Node Metadata API (`src/shared/metadata-storage.ts`)

On-disk shape (v2): `{ [sessionId]: { nodes: { [nodeId]: NodeMetadata }, lastUpdated } }`.
v1 stored the node map bare; `readStore` migrates on read and persists the
migration once, so the GC clock is not re-stamped on every read.

`NodeMetadata` is `{ bookmarked, tags, hidden }` — `hidden` collapses the node
out of the tree map (#167) and is the flag the conversation DOM will subscribe
to in #168. Records written before a field existed simply lack the key; every
write merges `DEFAULT_NODE_METADATA` first, so reads should still use
`?? false` rather than assuming the key is present.

| Function | Use |
|----------|-----|
| `getSessionMetadata(sessionId)` | Read one session's node map. Runs on **every** `TREE_READY` (frequent during streaming), so the `lastUpdated` touch only writes past a 1-hour threshold |
| `setNodeMetadata(sessionId, nodeId, patch)` | Patch **one** node |
| `setNodeMetadataBatch(sessionId, nodeIds, patch)` | Patch **many** nodes |
| `clearSessionMetadata` / `purgeOrphanedMetadata` | Delete one session / daily GC |

**Use the batch helper for multi-node writes — this is correctness, not
convenience.** Every setter does a full read-modify-write of the whole
multi-session store. Firing N `setNodeMetadata` calls in parallel has each one
read the store before the others have written, so all but the last patch are
silently lost. `setNodeMetadataBatch` does one read-modify-write for the whole
set (expanding a collapsed run of hidden nodes is the case that needs it).

There is no debouncing anywhere in this layer, so avoid attaching large
per-node payloads: each keystroke-level change rewrites the entire store.

---

## 8. Derived-Content Pipeline (issues #160, #161)

On-device summarization (Gemini Nano) **and** embedding (bundled MiniLM in an
offscreen document). Opt-in behind `UserSettings.summaryEnabled` (default
`false`, toggled in the panel settings) — one message feeds both.

Summaries are consumed by the Interactive Map (#165): keyword node labels plus a
Q&A dropdown — see §9. Relevance is still **produced but not consumed**;
`GET_RELEVANCE` answers on demand and no layout reads it yet.

> Model behavior, offscreen lifecycle, bundling, and the storage budget live in
> [running-on-device-ai](../running-on-device-ai/SKILL.md). This section covers
> only the message and storage contract.

```
scan a mounted turn (content)
     │  read { question, answer } off the DOM — see ../analyzing-claude-dom/SKILL.md §2-4
     ▼
Content → Background: { type: 'SUMMARIZE_TURNS', payload: { sessionId, turns } }
     │
     ▼
Background: summary-queue.ts — TWO independent serial drains
     ├─ drainSummary → summarizeOne → setNodeCache({ summary, summaryFallback })
     └─ drainEmbed   → embedOne     → setNodeCache({ embedding })
                          │  Background → offscreen: OFFSCREEN_EMBED
```

The queues are separate on purpose: embeddings must not depend on Gemini Nano
availability or on whether a turn was already summarized. Because both drains
run in parallel and patch the same entry, `setNodeCache` serializes its
read-modify-write through a promise chain — see §6.

### The answer is never persisted

The tree caches only the user prompt (`ChatboxNode.text`). The assistant answer
is read from the DOM at scan time, passed into the queue, and discarded — only
the derived `NodeSummary` is stored. Two reasons:

- Raw answers would bloat `chrome.storage.local` with text that is redundant
  once the summary exists.
- `session-store.updateTree` rebuilds the tree from the DOM on every update, so
  anything hung on `ChatboxNode` is wiped. Same reason summaries live in the
  separate node-cache (#159) rather than on the node.

**Accepted consequence:** a turn the user has never scrolled into view cannot be
summarized, because its answer was never mounted. Turns are summarized lazily as
they come into view; there is no backfill. By design, not a gap.

### Why the queue is serial and lives in the SW

Reading the answer is cheap and synchronous; summarizing is not (~2–7 s per
call, runaway up to ~5 min — see [running-on-device-ai](../running-on-device-ai/SKILL.md) §2). So it
must never run inside the DOM scan. Draining one at a time spreads the cost
instead of spiking on page load. It runs in the Background SW because that is
where the Prompt API and the node-cache live, and content scripts must not do
heavy work.

Each turn gets an `AbortSignal` timeout (`TIMING.SUMMARY_TIMEOUT_MS`). A failed
or timed-out turn still writes an entry — the truncated fallback — flagged with
`summaryFallback: true`.

### Dedup: two layers, one authority

| Layer | Scope | Purpose |
|-------|-------|---------|
| Content `summarizedSent` (`Set<nodeId>`) | one conversation visit; cleared on conversation change | **Send** throttle. The scan runs every ~100 ms; without it every tick re-sends the whole tree |
| SW node-cache lookup in `summarizeOne` / `embedOne` | permanent, cross-tab, survives reload | **Compute** authority — skip a node that already has the field this drain writes |

The two compute authorities are independent: `summarizeOne` keys on `summary`,
`embedOne` on `embedding`. A turn that already has a summary but no embedding
still gets embedded.

A `summaryFallback` entry *is* eligible for re-summarization, but the content
throttle means that only happens on a **later visit**. Deliberate: retrying
inside the same visit feeds identical input to the same model.

### Availability gating (summary queue only)

`drainSummary()` checks `typeof LanguageModel` first (the global is absent on
pre-138 / unsupported Chrome — permanent, so the summary backlog is dropped),
then `LanguageModel.availability()`. `drainEmbed()` has **no** such gate: its
model ships with the extension.

Anything other than `'available'` stops the drain but **keeps the backlog**: the
next completed turn re-enters `drainSummary()` and re-checks, so a finished model
download resumes in the same visit rather than waiting for a reload. Each backlog
is capped separately (`MAX_PENDING_TURNS`), evicting oldest first.

> Neither drain may re-enter itself from its own `finally`. The loop's
> `pending*.length > 0` check and `draining* = false` run in the same microtask,
> so there is no gap to cover — and on an error path that re-entry is an
> infinite loop. Regression test: `tests/unit/summary-queue.test.ts`.

The drain itself triggers no model **download**: `create()` cannot start one
from the SW without a user gesture. The download is kicked off from the settings
toggle instead — see §9.

### Known limitations (follow-ups)

- **Order-based pairing.** `scanMounted` pairs user bubbles to
  `.font-claude-response` elements by mounted DOM index. At virtualization
  boundaries (a bubble mounted while its answer is not, or vice versa) the
  alignment shifts and the wrong answer can attach to a node. A sibling-walk
  (bubble → adjacent answer) would fix it.
- **Edited / regenerated turns keep a stale summary.** Dedup is keyed on
  `nodeId` alone, and `chatbox-<absIndex>` is stable across an edit. Detecting
  the change needs a source signature (hash of question + answer) stored with
  the summary.
- **SW termination** drops the in-memory queue mid-drain. Self-heals on the next
  visit via node-cache dedup + content re-send.

---

## 9. Reading Summaries Back in the Panel (issue #165)

The pipeline in §8 ends in `chrome.storage.local`. The panel reads it **without
a message round-trip** — it runs in the content script and already talks to
storage directly (`getSessionMetadata`, `mirrorToChromeStorage`), so summaries
follow the same pattern.

| Function (`src/shared/node-cache.ts`) | Use |
|---|---|
| `getSessionSummaries(sessionId)` | Hydrate on `TREE_READY`, next to `getSessionMetadata` |
| `projectSummaries(cache)` | Project a raw session cache — used on the `onChanged` path |

**Both go through the projection on purpose: it drops `embedding` and keeps only
`summary`.** An embedding is ~2.8 KB per node (see `EMBEDDING_STORED_DECIMALS`)
and the panel has no use for one. Store the projection in
`panel-store.sessionSummaries`, never raw `NodeCacheEntry` values.

Two hydration paths, because a summary can arrive either before or after the
panel is looking at the conversation:

1. **On `TREE_READY`** — `App.tsx` calls `getSessionSummaries` for summaries
   computed on an earlier visit.
2. **On `chrome.storage.onChanged`** for `nodeCache_<sessionId>` — this is the
   only signal the panel gets while the queue drains, since the queue runs in
   the SW and writes straight to storage. Project `change.newValue` directly
   rather than re-reading. A **missing** `newValue` (cache clear, §5) must reset
   the map, not be skipped.

> **Known cost:** `onChanged` materializes the whole session cache — embeddings
> included — into the content script on every write, i.e. once per completed
> turn while `summaryEnabled` is on. Accepted over adding a `SUMMARY_READY`
> broadcast plus a content relay, which would touch four files for the same
> result. Revisit if the write rate ever stops being per-turn.

`setSessionSummaries` **replaces, never merges.** Node IDs encode absolute turn
position (`chatbox-<absIndex>`), so `chatbox-3` exists in most conversations and
a merge would attach the previous conversation's summary to an unrelated node.
The same hazard is why the Interactive Map clears its open-dropdown state on a
`sessionId` change.

### Drain progress (`summaryStatus`)

A turn can take 30s and the drain lives in the SW, so without a progress signal
"slow" and "broken" are indistinguishable from the panel. `summary-queue.ts`
publishes `SummaryQueueStatus { active, startedAt, pending }` to storage, and
the map renders it as an animated strip plus an elapsed counter
(`SummaryActivity.tsx`).

Three rules, each load-bearing:

- **Only published around the actual summarize loop.** The early returns above
  it — no Prompt API, model not `'available'` — must leave the status idle.
  Reporting "working" while nothing can run is the exact confusion this exists
  to remove. Regression tests: `tests/unit/summary-queue.test.ts`, *"never
  reports active when…"*.
- **One `startedAt` per run, not per turn.** The counter measures how long the
  AI has been busy overall; re-stamping per turn resets the display to 0:00
  mid-drain. `pending` counts down within that run.
- **Cleared at module scope.** A SW terminated mid-drain leaves `active: true`
  with nobody to clear it, and the panel would tick forever. A cold start
  proves no drain is in flight, and the SW wakes within seconds during an
  active conversation. `publishSummaryStatus` is `chrome`-guarded because that
  module-scope call runs on import.

### The model download lives on the toggle

`summaryEnabled`'s toggle in `ControlBar` is the **only user gesture in the
entire pipeline**, and Chrome will not start a Gemini Nano download without one.
So `src/content/panel/summary-model.ts` runs `ensureSummaryModel()` from that
click; the SW's queue then finds the model available on its next drain.

- The Prompt API **is** reachable from the content script's isolated world
  (`typeof LanguageModel === 'function'`, verified on claude.ai, Chrome
  151.0.7922.174 arm64). That is what makes this possible at all — it is not
  the case for every extension surface, so re-check before moving this code.
- **Do not `await LanguageModel.availability()` before `create()`.** Awaiting
  anything first risks spending the transient activation the download needs.
  An already-available `create()` resolves immediately and the throwaway
  session is destroyed at once — far cheaper than a lost download.
- `ensureSummaryModel` never rejects. It resolves `'ready' | 'unavailable' |
  'unsupported'` so the settings row can explain the outcome instead of
  silently doing nothing.

---

## References

- [analyzing-claude-dom](../analyzing-claude-dom/SKILL.md) — how DOM changes are detected and identified
- [detecting-branches](../detecting-branches/SKILL.md) — how the node list is built before `TREE_UPDATE`
- [building-panel-ui](../building-panel-ui/SKILL.md) — how `TREE_READY` is consumed
- [running-on-device-ai](../running-on-device-ai/SKILL.md) — the models behind `SUMMARIZE_TURNS` / `OFFSCREEN_EMBED`
