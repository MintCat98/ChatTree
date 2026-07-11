# Node Summarization (Chrome built-in AI) — spike #158

## Contract
- `NodeSummary { keyword (≤20 chars), question (1 sentence), answer (1–2 sentences) }`
- Structured output enforced via `NODE_SUMMARY_SCHEMA` passed as `responseConstraint`.
- Robustness: parse first `{…}` → schema-validate → retry once → truncated-text fallback.
- See [summary.ts](./../src/shared/summary.ts). Prompt: `SUMMARY_SYSTEM_PROMPT`; per-turn input: `buildConversationInput` (injects the target language).

## Evaluation

### Setup
- Model: Gemini Nano via Chrome built-in Prompt API (`responseConstraint = NODE_SUMMARY_SCHEMA`).
- Chrome: 149.0.7827.115, desktop, locale = ko-KR.
- Eval set: it#1–it#3 used a synthetic 7-turn set ({en, ko} × {short, long, code, follow-up}); it#4 used **real chat turns exported from the author's own conversations** ({en, ko}, n = 4) ([summary.eval.ts](./../src/shared/summary.eval.ts)).
- Rubric (auto): `ok` (valid JSON, no fallback) · `kwOk` (keyword ≤ 20) · `langOk` (output language == input language) · latency. Faithfulness and answer length judged manually (see Limitations re: `aSents`).

### Iterations
| run | change | ok | kwOk | langOk | note |
|-----|--------|----|------|--------|------|
| it#1 | system rule: "respond in the SAME language as the conversation" | 100% | 100% | **43%** | all 4 EN turns summarized in Korean |
| it#2 | system rule strengthened ("each request states a target language; never translate") | 100% | 100% | **43%** | no change — the per-turn input did not yet supply a target language |
| it#3 | target language injected into the per-turn input (`Target language: English/Korean`) | 100% | 100% | **100%** | all en/ko turns aligned |
| it#4 | real chat turns (n=4); prompt unchanged; `aSents` metric removed | 100% | 100% | **100%** | held on real content; `answer` length not always respected (see Limitations) |

- Latency: ~1.8–6.5 s/turn (on-device); longer/more complex answers take longer (e.g., a color-grading "LUT" turn took ~6.5 s).

### Findings
- Structured output is reliable: schema-valid on the first attempt across all runs; the fallback path was never triggered.
- Keyword length held: all keywords ≤ 20 characters.
- Output language was **not** controllable by prompt wording alone (it#1–it#2: English turns came out in Korean under a ko-locale Chrome). Injecting the target language into the per-turn input (it#3) aligned every turn, and this held on real chat turns (it#4). Faithfulness was good in all runs.

### Limitations
- Small eval sets (synthetic n=7 for it#1–it#3; real chat turns n=4 for it#4), single machine (locale = ko-KR), non-deterministic model → indicative, not statistical.
- Language detection is a Hangul heuristic (ko vs. en only); other or mixed-language turns are not covered.
- **`aSents` (auto sentence-count metric) was removed.** It counted every period, including those inside filenames/code (e.g., `hello.py`, `mv a.txt b.txt`), so it mis-scored code turns; answer length is now judged manually.
- **`answer` length is not reliably honored.** Despite the "1–2 sentences" instruction, Nano sometimes returns ~4–5 sentences on long/complex turns (e.g., the LUT color-grading answer). #165 should clamp/truncate the dropdown text, or #160 may post-process the answer.
- The truncated-text fallback path was not exercised in these runs.

## Handoff (#160 / #165)
- #160: run the pipeline per turn, cache results, and reuse `summarizeConversation` (target language already handled in `buildConversationInput`). Consider enforcing the `answer` length here (post-processing) since the prompt alone does not.
- #165: render `keyword` on the node, `question`/`answer` in the dropdown; clamp/truncate `answer` for layout given the length variability above.
