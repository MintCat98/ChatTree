# Node Summarization (Chrome built-in AI) — spike #158

## Contract
- `NodeSummary { keyword (≤20 chars), question (1 sentence), answer (1–2 sentences) }`
- Structured output enforced via `NODE_SUMMARY_SCHEMA` passed as `responseConstraint`.
- Robustness: each attempt runs in an **isolated session** (`session.clone()`); parse first `{…}` → schema-validate → retry once → truncated-text fallback.
- See [summary.ts](./../src/shared/summary.ts). Prompt: `SUMMARY_SYSTEM_PROMPT`; per-turn input: `buildConversationInput` (injects the target language).

## Evaluation

### Setup
- Model: Gemini Nano via Chrome built-in Prompt API (`responseConstraint = NODE_SUMMARY_SCHEMA`).
- Chrome: 149.0.7827.115, desktop, locale = ko-KR.
- Eval set: it#1–it#3 used a synthetic 7-turn set ({en, ko} × {short, long, code, follow-up}); it#4–it#5 used **real chat turns exported from the author's own conversations** ({en, ko}, n = 4 then n = 5) ([summary.eval.ts](./../src/shared/summary.eval.ts)).
- Rubric (auto): `ok` (valid JSON, no fallback) · `kwOk` (keyword ≤ 20) · `langOk` (output language == input language) · latency. Faithfulness and answer length judged manually (see Limitations re: `aSents`).

### Iterations
| run | change | ok | kwOk | langOk | note |
|-----|--------|----|------|--------|------|
| it#1 | system rule: "respond in the SAME language as the conversation" | 100% | 100% | **43%** | all 4 EN turns summarized in Korean |
| it#2 | system rule strengthened ("each request states a target language; never translate") | 100% | 100% | **43%** | no change — the per-turn input did not yet supply a target language |
| it#3 | target language injected into the per-turn input (`Target language: English/Korean`) | 100% | 100% | **100%** | all en/ko turns aligned |
| it#4 | real chat turns (n=4); prompt unchanged; `aSents` metric removed | 100% | 100% | **100%** | held on real content; `answer` length not always respected (see Limitations) |
| it#5 | per-attempt **session isolation** (`session.clone()`); real chat turns (n=5) | 100% | 100% | **100%** | resolved the sporadic `QuotaExceededError` seen when a single session was reused across turns |

- Latency: ~1.8–6.5 s/turn (on-device); longer/more complex answers take longer (e.g., a color-grading "LUT" turn took ~5–6.5 s).

### Findings
- Structured output is reliable: once each call runs in an isolated session, all real turns (n=5) were schema-valid on the first attempt.
- Keyword length held: all keywords ≤ 20 characters.
- Output language was **not** controllable by prompt wording alone (it#1–it#2: English turns came out in Korean under a ko-locale Chrome). Injecting the target language into the per-turn input (it#3) aligned every turn, and this held on real chat turns (it#4–it#5). Faithfulness was good in all runs.
- **Each summarization must run in an isolated session.** The Prompt API session is conversational: reusing one session across turns accumulates each turn's input and output into its context, which exhausts Nano's token budget and raises `QuotaExceededError` on later turns. Cloning the primed session per attempt (`session.clone()`) isolates each call and removed these failures.

### Limitations
- Small eval sets (synthetic n=7 for it#1–it#3; real chat turns n=4→5 for it#4–it#5), single machine (locale = ko-KR), non-deterministic model → indicative, not statistical.
- Language detection is a Hangul heuristic (ko vs. en only); other or mixed-language turns are not covered.
- **Sporadic runaway output.** Nano occasionally over-generates and throws `QuotaExceededError` ("response exceeded output limits and was truncated"), even for short, plain inputs; the affected turn varied between runs (non-deterministic). It is amplified by session reuse (context accumulation). Mitigated by per-attempt session isolation + retry + truncated fallback, so a small fraction of turns may still fall back.
  - **Cost is high: an affected call can hang for ~5 minutes before it finally errors.** The truncated fallback keeps the output usable, but this latency is not acceptable in production — an additional safeguard is required (a hard timeout via `AbortSignal`, and/or an output-token cap), to be handled in #160.
- **`aSents` (auto sentence-count metric) was removed.** It counted every period, including those inside filenames/code (e.g., `hello.py`, `mv a.txt b.txt`), so it mis-scored code turns; answer length is now judged manually.
- **`answer` length is not reliably honored.** Despite the "1–2 sentences" instruction, Nano sometimes returns ~4–5 sentences on long/complex turns (e.g., the LUT color-grading answer). #165 should clamp/truncate the dropdown text, or #160 may post-process the answer.

## Handoff (#160 / #165)
- #160: run the pipeline per turn, cache results, and reuse `summarizeConversation`. **Run each summary in its own (cloned) session** — do not share one session across turns. Add a **hard timeout (`AbortSignal`)** — a runaway generation can hang ~5 min before erroring. Consider enforcing `answer` length here (post-processing) since the prompt alone does not.
- #165: render `keyword` on the node, `question`/`answer` in the dropdown; clamp/truncate `answer` for layout given the length variability above.
