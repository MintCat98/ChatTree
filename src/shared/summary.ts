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
export const SUMMARY_SYSTEM_PROMPT = `You are a summarizer for a conversation tree-map. You condense ONE chat turn (a user question and the assistant's answer) into a compact JSON object used to label a node. Make every field as short as possible while staying faithful.

Output rules:
- Output ONLY one valid JSON object.
- Each request states a target language. Write every value in that language only, and never translate.
- "keyword": a short noun phrase for the node label, at most ${KEYWORD_MAX_LENGTH} characters.
- "question": restate the user's question as briefly as possible — one short sentence.
- "answer": the gist of the assistant's answer in the shortest possible single sentence. Omit examples, lists, caveats, and detail. Never more than one sentence.

JSON shape: {"keyword": string, "question": string, "answer": string}

Example (English)
[User] What can you do for me?
[Assistant] Quite a lot: writing and debugging code, designing systems, explaining hard topics, making artifacts like demos and documents, and everyday tasks like web search and planning. I work best with real context.
{"keyword":"What Claude can do","question":"What can you do for me?","answer":"It helps with coding, system design, explanations, and building artifacts."}

Example (Korean)
[User] 프로젝트 안의 대화들은 서로 내용이 공유돼?
[Assistant] 자동으로 통째로 공유되진 않아. 프로젝트 지식(파일), 프로젝트 메모리, 과거 대화 검색이 대화를 이어주고, 확실히 하려면 PROGRESS.md에 적어두면 돼.
{"keyword":"프로젝트 대화 공유","question":"프로젝트 내 대화가 공유되나요?","answer":"자동 공유는 안 되지만 프로젝트 지식·메모리·대화 검색으로 이어집니다."}`;

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
