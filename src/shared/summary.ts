const MAX_ATTEMPTS = 2; // initial + one retry

// Built-in AI response format format
export interface NodeSummary {
  keyword: string; // Node Label
  question: string; // 1 sentence for user question
  answer: string; // 1-2 sentence for Claude response
}
export const KEYWORD_MAX_LENGTH = 20;
export const NODE_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    keyword: { type: 'string', maxLength: KEYWORD_MAX_LENGTH },
    question: { type: 'string' },
    answer: { type: 'string' },
  },
  required: ['keyword', 'question', 'answer'],
  additionalProperties: false,
} as const;

// Built-in AI system prompt
export const SUMMARY_SYSTEM_PROMPT = `You are a summarizer for a conversation tree-map. You condense ONE chat turn (a user question and the assistant's answer) into a compact JSON object used to label a node.

Output rules:
- Output ONLY one valid JSON object.
- Each request states a target language. Write every value in that target language and do not switch languages.
- Exception: keep technical terms, jargon, code identifiers, and proper nouns in their ORIGINAL form (usually English) instead of translating them — e.g., LUT, split toning, bleach bypass, useEffect.
- "keyword": a short noun phrase for the node label, at most ${KEYWORD_MAX_LENGTH} characters.
- "question": restate the user's question in EXACTLY ONE short sentence.
- "answer": summarize the assistant's answer concisely, in AT MOST three sentences.

JSON shape: {"keyword": string, "question": string, "answer": string}

Example (English)
[User] What can you do for me?
[Assistant] Quite a lot: writing and debugging code, designing systems, explaining hard topics, making artifacts like demos and documents, and everyday tasks like web search and planning. I work best with real context.
{"keyword":"What Claude can do","question":"What can you do for me?","answer":"It helps with coding, system design, explanations, and building artifacts like demos and documents. It works best when you give clear context."}

Example (Korean)
[User] LUT 종류를 어떻게 골라야 해?
[Assistant] LUT를 정해진 '종류'로 외우기보다 color relationship, split toning, 대비, 채도 같은 레버의 조합으로 보는 게 좋아. 틸-오렌지나 bleach bypass 같은 유명한 look은 그 조합에 이름을 붙인 것뿐이고, 어떤 걸 쓸지는 장면이 관객에게 주려는 감정에 달렸어. 피부톤은 보호하는 게 핵심이야.
{"keyword":"LUT 색상 관계","question":"LUT는 어떻게 골라야 하나요?","answer":"LUT를 종류로 외우기보다 color relationship, split toning, 대비, 채도의 조합으로 이해하는 것이 좋습니다. 유명한 look들은 그 조합에 이름을 붙인 것이며, 무엇을 쓸지는 장면이 전달하려는 감정에 달려 있습니다. 피부톤 보호가 핵심입니다."}`;

// Built-in AI user conversation input format
export function buildConversationInput(question: string, answer: string): string {
  const language = /[가-힣]/.test(`${question} ${answer}`) ? 'Korean' : 'English';
  return `Target language: ${language}. Write "keyword", "question", and "answer" only in ${language}.
[User] ${question}
[Assistant] ${answer}`;
}

function extractJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no JSON object found');
  return JSON.parse(match[0]);
}

function isNodeSummary(value: unknown): value is NodeSummary {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.keyword === 'string' &&
    o.keyword.length > 0 &&
    typeof o.question === 'string' &&
    typeof o.answer === 'string'
  );
}

// Built-in AI response format
export interface SummaryResult {
  ok: boolean;
  summary: NodeSummary | null;
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length <= n ? t : t.slice(0, n - 1) + '...';
}

function fallbackSummary(question: string, answer: string): NodeSummary {
  return {
    keyword: truncate(question, KEYWORD_MAX_LENGTH),
    question: truncate(question, 120), // declaration later
    answer: truncate(answer, 200), // declaration later
  };
}

export async function summarizeConversation(
  session: LanguageModelSession,
  question: string,
  answer: string
): Promise<SummaryResult> {
  const input = buildConversationInput(question, answer);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let raw: string | undefined;
    try {
      raw = await session.prompt(input, { responseConstraint: NODE_SUMMARY_SCHEMA });
      const parsed = extractJson(raw);
      if (isNodeSummary(parsed)) {
        return {
          ok: true,
          summary: {
            keyword: parsed.keyword.slice(0, KEYWORD_MAX_LENGTH),
            question: parsed.question,
            answer: parsed.answer,
          },
        };
      }
      console.warn('[summary] parsed but invalid shape:', parsed, '\nRAW>>>', raw, '<<<');
    } catch (err) {
      // Malformed or non-JSON output - ignore, let the loop retry
      // fall through to the truncated fallback below
      console.warn('[summary] prompt/parse failed, will retry of fall back:', err, '\nRAW>>>', raw, '<<<');
    }
  }

  return { ok: false, summary: fallbackSummary(question, answer) };
}
