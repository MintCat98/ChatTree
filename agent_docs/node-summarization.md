# Node Summarization (Chrome built-in AI) — spike #158

## Contract
- `NodeSummary { keyword (≤20 chars), question (one sentence), answer (≤3 sentences) }`
- Neutral, factual style; technical terms / jargon / proper nouns kept in their original form (usually English).
- Structured output enforced via `NODE_SUMMARY_SCHEMA` passed as `responseConstraint`.
- Robustness: each attempt runs in an **isolated session** (`session.clone()`); parse first `{…}` → schema-validate → retry once → truncated-text fallback.
- See [summary.ts](./../src/shared/summary.ts). Prompt: `SUMMARY_SYSTEM_PROMPT`; per-turn input: `buildConversationInput` (detects the turn language and injects the target language).

## Evaluation

### Setup
- Model: Gemini Nano via Chrome built-in Prompt API (`responseConstraint = NODE_SUMMARY_SCHEMA`).
- Chrome: 149.0.7827.115, desktop, locale = ko-KR.
- Eval set: it#1–it#3 used a synthetic 7-turn set; it#4–it#6 used **real chat turns exported from the author's own conversations** ({en, ko}, n = 4 → 5) ([summary.eval.ts](./../src/shared/summary.eval.ts)).
- Language detection: from the **question**, by dominant script (Hangul vs. Latin count), replacing the earlier "any Hangul ⇒ Korean" rule.
- Rubric (auto): `ok` (valid JSON, no fallback) · `kwOk` (keyword ≤ 20) · `langOk` (output language == input language) · latency. Tone, length, and jargon judged manually.

### Iterations
| run | change | ok | kwOk | langOk | note |
|-----|--------|----|------|--------|------|
| it#1 | system rule: "respond in the SAME language" | 100% | 100% | **43%** | all EN turns summarized in Korean |
| it#2 | system rule strengthened ("target language; never translate") | 100% | 100% | **43%** | no change — per-turn input did not yet supply a target language |
| it#3 | target language injected into the per-turn input | 100% | 100% | **100%** | all en/ko turns aligned |
| it#4 | real chat turns (n=4); `aSents` removed | 100% | 100% | **100%** | `answer` length not always respected |
| it#5 | per-attempt **session isolation** (`session.clone()`); n=5 | 100% | 100% | **100%** | resolved the sporadic `QuotaExceededError` from reusing one session |
| it#6 | neutral/formal tone + jargon(proper-noun) preservation + length rules (Q = one sentence, A ≤ 3 sentences) + ratio-based language detection on the question | 100% | 100% | **80%\*** | \*the single langOk miss is a metric false-negative (see Findings) |

- Latency: ~2–7 s/turn (on-device); longer/more complex answers take longer.

### Findings
- Structured output is reliable: with per-attempt session isolation, all real turns were schema-valid on the first attempt.
- Keyword length held (≤ 20). Question is reliably compressed to a single sentence.
- Language alignment holds when the target language is injected per turn (it#3+).
- **Proper-noun / jargon retention works in the clear case:** an English summary of a Korean-food turn kept `떡볶이 (tteokbokki)` and `순대 (sundae)` in Korean rather than translating them (EN-2).
- **The `langOk` metric is too crude.** It flags *any* Hangul in an English answer as a language mismatch, so EN-2 scored `langOk=false` even though the English summary was correct and merely retained Korean proper nouns. Read langOk with this caveat (true alignment in it#6 was effectively 100%).

### Limitations
- Small eval sets (n=7 synthetic; n=4→5 real), single machine (locale = ko-KR), non-deterministic model → indicative, not statistical.
- Language detection is a heuristic (dominant script of the question); genuinely mixed-language turns remain approximate.
- **`langOk` false negatives:** an English summary that legitimately retains Korean proper nouns is scored as a mismatch (metric limitation, not an output error).
- **Tone drifts.** English still tends to first person ("I can…"); Korean mixes `합니다체` and `-다체`. Not fully consistent from the prompt alone.
- **Jargon preservation is inconsistent.** Some domain terms are transliterated (e.g., `스플릿 토닝` instead of `split toning`) rather than kept in English.
- **`answer` length is not reliably honored for Korean** long/complex turns (can exceed 3 sentences).
- **Sporadic runaway output.** Nano occasionally over-generates and throws `QuotaExceededError`, even for short inputs (non-deterministic; amplified by session reuse). Mitigated by per-attempt session isolation + retry + truncated fallback.
  - **Cost is high: an affected call can hang ~5 minutes before erroring.** A hard timeout (`AbortSignal`) and/or output-token cap is needed in #160.
- `aSents` (auto sentence-count metric) was removed — it miscounted periods in filenames/code.

### Example outputs

**EN — capabilities turn** (long, structured answer → concise summary)
```
[User] What can you do for me?
[Claude] Quite a lot — here's the practical shape of it, Taebin:
  Thinking and building things with you — writing/debugging/reviewing code (C/C++, Python, Go, TS),
  designing systems (architecture, data structures, algorithms), explaining hard things from first principles.
  Making artifacts — interactive demos, visualizations, documents/slides/PDFs, running code in a sandbox.
  Everyday things — web search, drafting/editing text in English or Korean, reading uploaded files, planning.
  The catch: I'm better when you give real context and push back. Vague question in, vague answer out.
<<< summarizeConversation() Result >>>
[Question] What can you do for me?
[Keyword]  Capabilities
[Answer]   I can assist with a wide range of tasks, including code writing, debugging, system design, explaining complex concepts, and creating interactive demos, documents, and running code in a sandbox. I can also perform everyday actions like web searching, text drafting, and planning. My performance depends on receiving real context and constructive feedback.
```

**KO — LUT color-grading turn** (very long jargon-heavy answer → compressed question + concise answer)
```
[User] 혹시 많이들 사용하는 lut 종류가 있나? 색감의 분류라던가, 어느 상황에 어떤 lut을 쓰는지 이론이 있을까?
[Claude] "LUT 종류"로 접근하면 끝이 없으니, 룩(look)을 만드는 4~5개 레버(색상 대비, 스플릿 토닝,
  대비 커브, 채도, 필름 에뮬레이션)로 분해하는 방식으로 설명. 색환 이론(보색/유사색/단색조)과
  피부톤(memory color) 보호 원칙, 유명 룩 패밀리(틸앤오렌지, 블리치 바이패스, 페이드/매트 …),
  상황→색-감정 매핑, "동기부여된 색" 원칙까지 이어짐.  [… 상세 생략 …]
<<< summarizeConversation() Result >>>
[Question] LUT 선택의 핵심은 무엇인가?
[Keyword]  색상 관계
[Answer]   LUT 종류로 접근하면 복잡하므로, 색환 이론을 바탕으로 룩을 구성하는 몇 개의 레버로 분해하는 것이 효과적입니다. 색환 관계는 색상 대비, 스플릿 토닝, 대비, 채도, 필름 에뮬레이션을 포함합니다. 피부톤은 보호해야 하며, 각 룩은 특정 상황과 감정을 표현하도록 설계된 이름표입니다. 상황에 따른 색 매핑은 감정과 연관되어 있으며, 동기부여된 색과 피부 보호를 고려하여 LUT를 선택해야 합니다.
```
> Note: this KO answer ran to 4 sentences (over the ≤3 target) and transliterated jargon (`스플릿 토닝` instead of `split toning`) — see Limitations.

## Handoff (#160 / #165)
- #160: run the pipeline per turn, cache results, reuse `summarizeConversation`. **Run each summary in its own (cloned) session.** Add a **hard timeout (`AbortSignal`)** (runaway can hang ~5 min). Enforce `answer` length / tone / jargon by **post-processing** — the prompt alone does not fully control them.
- #165: render `keyword` on the node, `question`/`answer` in the dropdown; clamp/truncate `answer` for layout.
- Metric note: replace the Hangul-based `langOk` with a proper-noun-aware check before relying on it in later evaluations.
