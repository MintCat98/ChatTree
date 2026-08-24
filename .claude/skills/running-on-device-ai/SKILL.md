---
name: running-on-device-ai
description: On-device AI in ChatTree - the summary queue (Gemini Nano) and the embedding queue (offscreen transformers.js), offscreen document lifecycle, build-time model delivery, and the webpack/onnxruntime constraints they impose. Use when working on src/background/summary-queue.ts, src/background/embed.ts, src/offscreen/, or when changing model, bundling, or storage-budget behavior.
---

# Running On-Device AI

> **Purpose:** How ChatTree derives summaries (#160) and embeddings (#161)
> entirely on-device, and the constraints that shape both.
> **Depends on:** [messaging-and-storage](../messaging-and-storage/SKILL.md) §6, §8

---

## 1. Two queues, not one

`src/background/summary-queue.ts` owns **two independent queues**. Every turn
sent via `SUMMARIZE_TURNS` is pushed onto both.

| | summary queue | embedding queue |
|---|---|---|
| Model | Gemini Nano (Prompt API, Chrome-managed) | transformers.js MiniLM, bundled |
| Runs in | Background SW | offscreen document |
| Availability gate | `LanguageModel` global + `availability()` | **none** |
| Dedup key | `entry.summary && !entry.summaryFallback` | `entry.embedding` |
| Drain / worker | `drainSummary` / `summarizeOne` | `drainEmbed` / `embedOne` |
| Backlog | `pendingSummary`, capped at `MAX_PENDING_TURNS` | `pendingEmbed`, same cap |

**Do not merge them back into one drain.** An embedding is a deterministic
signal, and #161 explicitly rejected LLM-judged relevance to avoid depending on
generative output. A shared drain silently reintroduced that dependency twice
over: embeddings were gated behind Gemini Nano availability, and the summary
dedup `return` also skipped the embedding, so an already-summarized turn could
never be backfilled. Regression tests live in
`tests/unit/summary-queue.test.ts` under *"embedding is independent of the
summary pipeline"*.

Both drains share one re-entrancy rule: **never re-enter a drain from its own
`finally`.** The loop's `pending*.length > 0` check and `draining* = false` run
in the same microtask, so there is no gap to cover — and on an error path the
re-entry is an infinite loop.

Because the two drains now run **in parallel** and patch different fields of the
same cache entry, `setNodeCache` serializes its writes through a promise chain.
Without it, whichever of summary/embedding finished first was lost.

## 2. Summary path: prompt contract and gotchas (Gemini Nano)

Contract: `NodeSummary { keyword ≤20 chars, question (one sentence), answer (≤3
sentences) }`, enforced with `NODE_SUMMARY_SCHEMA` as `responseConstraint`.
Parse the first `{…}` → schema-validate → retry once → truncated-text fallback.
Source of truth: `src/shared/summary.ts`.

**Two prompt rules exist for a measured reason. Do not "simplify" them away:**

- **The target language is injected into the per-turn input, not stated in the
  system prompt.** A system-prompt rule ("respond in the SAME language") held at
  only **43%** language alignment, and *strengthening* the wording changed
  nothing. Moving the target language into `buildConversationInput` took it to
  **100%**. Language is detected from the **question** by dominant script
  (Hangul vs Latin count) — an earlier "any Hangul ⇒ Korean" rule misfired on
  English turns that quoted Korean terms.
- **Clone the session per attempt.** `summarizeConversation` clones a base
  session for each try; reusing one session *across* attempts triggers sporadic
  `QuotaExceededError`. An affected call can hang **~5 minutes** before
  throwing — that number is why `TIMING.SUMMARY_TIMEOUT_MS` exists, not just
  tidiness.

Other gating rules:

- `typeof LanguageModel === 'undefined'` is permanent for the browser session →
  drop the summary backlog. Anything else non-`'available'` → stop but **keep**
  the backlog so a finished download resumes without a reload.
- No model **download** is triggered: `create()` cannot start one from the SW
  without a user gesture.
- Every turn gets `TIMING.SUMMARY_TIMEOUT_MS` via `AbortSignal`; a failure still
  writes a truncated fallback flagged `summaryFallback: true`.

## 3. Offscreen document lifecycle

The SW has no DOM and too short a life to host inference, so the model runs in
an offscreen document. `src/background/embed.ts` owns the SW side,
`src/offscreen/offscreen.ts` the document side.

```
embedOne → embedViaOffscreen (embed.ts)
   ├─ ensureOffscreen()      create if absent; permission: "offscreen"
   ├─ sendMessage { target: 'offscreen', type: OFFSCREEN_EMBED, text }
   ├─ race against TIMING.EMBED_TIMEOUT_MS
   └─ on timeout: closeDocument() so the next call starts fresh
offscreen.ts
   ├─ routes only { target: 'offscreen' } messages
   ├─ warms the model up ONCE at load
   └─ window.close() after TIMING.OFFSCREEN_IDLE_MS with no work
```

Four rules that are easy to get wrong, each of which has bitten this code:

1. **Bound the request.** The offscreen listener holds the channel open
   (`return true`) and replies only when inference resolves. A model that never
   finishes loading leaves `embedViaOffscreen` pending forever, pinning
   `drainingEmbed` and silently stopping every later turn.
2. **Warm up at module load, not inside the listener.** The document receives
   *every* runtime message in the extension, so a warm-up inside the listener
   loads the model for unrelated traffic.
3. **Never cache a rejected `extractorP`.** The document outlives one failure;
   a memoized rejection would fail every later turn with no way to recover.
   `getExtractor` nulls the memo on rejection.
4. **The idle timer belongs in the document, not the SW.** The SW is torn down
   when idle, so a timer there cannot be trusted to fire. A plain `setTimeout`
   is fine in a document — the "use `chrome.alarms`" rule is about the SW.

Messages to the offscreen document are addressed with `target: 'offscreen'`.
`chrome.runtime.sendMessage` does not deliver to the sending context, so the SW
never receives its own embed requests.

**Long turns are chunked, not truncated.** The model reads at most
`model_max_length` (512) tokens — ~2,300 characters of English but only ~930 of
Korean, since this tokenizer spends 1.8 chars/token on Hangul against 4.5 on
Latin. `chunkToBudget` splits on token **ids** (exact for any script), embeds
each chunk, and averages them **unweighted** before renormalizing. Two things to
keep:

- Unweighted, not token-weighted. Weighting by chunk length re-biases the vector
  toward the opening chunk, which is what truncation already did — it measured
  worse (2/4 vs 3/4 on the retrieval probe below).
- `MAX_CHUNKS` caps a pathological turn at 8 forward passes. Long turns cost
  ~97 ms instead of ~52 ms; turns inside the budget are a single pass and pay
  nothing.

Evidence: on long single-topic sections, a follow-up quoting content from the
END of a section retrieved that section **0/4** times when the source was
truncated, and **3/4** after chunking.

## 4. Model delivery (build time)

`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, q8, 384-dim. **The multilingual
model is deliberate** — the smaller English-only MiniLM was rejected because
this project's conversations mix Korean and English. Measured cosine on the
spike set: the same topic across languages scored **0.76** (ko/en "cat") and
**0.94** (ko/en "database"), while unrelated topics stayed near or below zero.
Re-run that comparison before swapping the model or the quantization.

**q8 is already the floor — do not go looking for a smaller quantization.** 82%
of this model is the embedding table alone (vocab 250,037 × 384 = 96.2 M of
117.4 M parameters), because the vocabulary is multilingual. Quantizing the
twelve encoder layers barely moves the total, and the q4 export leaves the
embedding table at full precision, so it is *larger*:

| variant | size | |
|---|---|---|
| `model_quantized` (q8) | 112.8 MB | shipped |
| `model_uint8` | 112.6 MB | no meaningful gain |
| `model_q4f16` | 195.3 MB | |
| `model_fp16` | 224.4 MB | |
| `model_q4` | 380.2 MB | 3.4× *larger* |

Sizes predicted from the parameter count match the published files to within
1%, so this is arithmetic, not a quirk of one export. The only real lever is the
**vocabulary** — prune it to ko/en, or move to a bilingual model with a smaller
vocab — and either means re-exporting the weights and re-pinning the checksums
below.

The model is **not committed** — the quantized ONNX file is ~113 MB, over
GitHub's limit. `scripts/fetch-model.mjs` downloads it into `public/models/`
(git-ignored) via the `prebuild` / `predev` npm hooks; webpack's `CopyPlugin`
then copies it into `dist/`. **The shipped extension is fully offline** — no CDN,
no host permission, `env.allowRemoteModels = false`.

- Downloads are pinned to a **revision SHA**, never `main`, and every file is
  verified against a **sha256** recorded in the script.
- Bytes land as `<file>.part` and are renamed only after the checksum passes;
  an existing file is re-hashed rather than trusted. An interrupted download
  must never be mistaken for a complete one.
- To move to a new revision, update `REVISION` **and** every hash. Get hashes
  from the `x-linked-etag` header on each resolve URL (it is the sha256 for LFS
  files) or by hashing a verified download.
- **Consequence:** builds need network on a clean checkout. There is no CI in
  this repo yet; if one is added, cache `public/models/`.

## 5. Bundling constraints (webpack + onnxruntime)

Each of these produces a confusing runtime failure if missed:

| Constraint | Why |
|---|---|
| `module.parser.javascript.importMeta = false` | webpack shims transformers' `import.meta` → `__webpack_module__ is not defined` |
| `HtmlWebpackPlugin({ scriptLoading: 'module' })` + `<script type="module">` | same root cause |
| Copy **both** `ort-*.wasm` and `ort-*.mjs` | onnxruntime needs the loaders next to the wasm (`wasmPaths` dir) |
| `env.allowLocalModels = true` | defaults to **false** in a browser context |
| `env.useBrowserCache = false` | `chrome-extension://` caching is unsupported |
| `localModelPath` / `wasmPaths` via `chrome.runtime.getURL` | resolve against the extension origin |
| Manifest `offscreen` permission + CSP `script-src 'self' 'wasm-unsafe-eval'` | wasm will not instantiate otherwise |
| Model folder layout `<model-id>/onnx/model_quantized.onnx` + tokenizer files | transformers.js resolves paths by convention |

`tsconfig.json` sets `skipLibCheck: true` because `@huggingface/tokenizers`
ships `.d.ts` files with unresolved internal aliases. Project source is still
fully type-checked.

## 6. Storage budget

Embeddings are the largest writer in `chrome.storage.local`, which is capped at
**10 MB** and shared with the tree cache.

- Vectors are rounded to `EMBEDDING_STORED_DECIMALS` (4) on the way out of
  `embedViaOffscreen`: ~2.8 KB per 384-dim vector instead of ~8 KB, moving
  cosine similarity by <2e-4. Round at the producer, not the cache, so no
  writer can forget.
- `setNodeCache` escalates on a quota failure: **purge orphans → retry → evict
  the oldest quarter of other sessions' caches → retry → throw.** Orphans go
  first because a live cache costs a full model re-run to rebuild, unlike a
  tree, which is re-derived from the DOM for free.
- Relevance is **derived on read** (`cosineSimilarity` in
  `src/background/relevance.ts`), never stored — it is pairwise and would go
  stale as turns are added.

## 7. Known limitations

Embedding side:

- **Turns past ~4,000 tokens still lose their tail.** Chunking (§3) raised the
  ceiling from 512 tokens to `MAX_CHUNKS × 510`, but a turn longer than that is
  still cut. The cap is a latency bound, not a quality judgement; raise it if
  real conversations turn out to need it.
- **Package size is settled at ~113 MB** — see §4. Only a vocabulary change
  moves it, which is a model swap, not a build flag.
- **Relevance thresholds** are unvalidated beyond the spike set: related ≈ 0.4+,
  same ≈ 0.9.
- **The chunking evidence used repo documentation, not real chat turns.**
  Sections of these skills are the closest offline stand-in — single-topic,
  long-form, technical. The direction is unambiguous (0/4 → 3/4 on the
  retrieval probe), but the exact numbers would move on real conversation data.

Summary side — all confirmed during the #158 evaluation and still open. #165
(rendering) will hit these first:

- **Tone drifts.** English output leans first person ("I can…"); Korean mixes
  `합니다체` and `-다체`. The prompt alone does not pin this down.
- **Jargon is inconsistently preserved.** Proper nouns survive in the clear case
  (a Korean-food turn kept `떡볶이`/`순대`), but domain terms are sometimes
  transliterated (`스플릿 토닝` instead of `split toning`).
- **The `answer` ≤3-sentence limit is not honored for long Korean turns.**
- Enforcing length/tone/jargon likely needs **post-processing**, not more prompt
  text — that was the #158 handoff conclusion.
- **Evaluation caveat:** the eval harnesses are `src/shared/summary.eval.ts` and
  `src/background/embed.eval.ts` (reference tooling, no callers). Their `langOk`
  metric flags *any* Hangul in an English answer as a language mismatch, so a
  correct English summary that retains Korean proper nouns scores as a failure.
  Fix that metric before trusting a re-run. Sample sizes were small (n=4–7,
  single machine, locale ko-KR, Chrome 149) — indicative, not statistical.

## References

- [messaging-and-storage](../messaging-and-storage/SKILL.md) — message contracts, node-cache schema, retention
- Source: `src/shared/summary.ts` (prompt + schema), `src/background/summary-queue.ts`, `src/background/embed.ts`, `src/offscreen/offscreen.ts`
- Tests: `tests/unit/summary-queue.test.ts`, `embed.test.ts`, `offscreen.test.ts`, `node-cache.test.ts`
- Original spike records were folded into this skill and removed. The raw tables
  survive in git: `git show 06c3f5e:docs/spikes/node-summarization.md` (#158) is
  on `dev`; the #161 record only ever existed on the PR #191 branch, so if that
  branch was squash-merged it is reachable only through the PR itself.
