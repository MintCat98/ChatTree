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
- Eval set: 7 turns — {en, ko} × {short, long, code, follow-up} ([summary.eval.ts](./../src/shared/summary.eval.ts)).
- Rubric (auto): `ok` (valid JSON, no fallback) · `kwOk` (keyword ≤ 20) · `langOk` (output language == input language) · latency. Faithfulness judged manually.

### Iterations
| run | change | ok | kwOk | langOk | note |
|-----|--------|----|------|--------|------|
| it#1 | system rule: "respond in the SAME language as the conversation" | 100% | 100% | **43%** | all 4 EN turns summarized in Korean |
| it#2 | system rule strengthened ("each request states a target language; never translate") | 100% | 100% | **43%** | no change — the per-turn input did not yet supply a target language |
| it#3 | target language injected into the per-turn input (`Target language: English/Korean`) | 100% | 100% | **100%** | all en/ko turns aligned |

- Latency: ~1.8–4.5 s/turn (on-device).

### Findings
- Structured output is reliable: 7/7 schema-valid on the first attempt; the fallback path was never triggered.
- Keyword length held: all keywords ≤ 20 characters.
- Output language was **not** controllable by prompt wording alone (it#1–it#2: English turns came out in Korean under a ko-locale Chrome). Injecting the target language into the per-turn input (it#3) aligned every turn (langOk 100%). Faithfulness was good in all runs.

### Limitations
- n = 7, single machine (locale = ko-KR), non-deterministic model → indicative, not statistical.
- Language detection is a Hangul heuristic (ko vs. en only); other or mixed-language turns are not covered.
- `aSents` counts periods (incl. those in filenames/code), so it is unreliable for code turns; sentence count judged manually.
- The truncated-text fallback path was not exercised in these runs.

## Handoff (#160 / #165)
- #160: run the pipeline per turn, cache results, and reuse `summarizeConversation` (target language already handled in `buildConversationInput`).
- #165: render `keyword` on the node, `question`/`answer` in the dropdown.
