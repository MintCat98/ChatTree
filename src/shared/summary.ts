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
- Each request states a target language. Write every value (keyword, question, answer) in that language only, and never translate.
- "keyword": a short noun phrase for the node label, at most ${KEYWORD_MAX_LENGTH} characters.
- "question": 1 sentence summarizing what the user asked.
- "answer": 1~2 sentences summarizing the assistant's answer.

JSON shape: {"keyword": string, "question": string, "answer": string}

Example (English)
[User] What can you do for me?
[Assistant] Quite a lot — here's the practical shape of it, Taebin:
Thinking and building things with you

Writing, debugging, and reviewing code (C/C++, Python, Go, TS, whatever), including gnarly low-level stuff like your game engine work — collision, timing loops, rendering, build setup.
Designing systems: architecture, data structures, game mechanics, algorithms. I'm happy to argue with you about tradeoffs rather than just agree.
Explaining hard things from first principles — physics, biology, math, graphics — and being corrected when I'm sloppy.

Making artifacts

Interactive demos, visualizations, diagrams that render right here in chat.
Documents, slides, spreadsheets, PDFs you can download.
Running actual code in a sandbox to test, analyze data, or generate files.

Everyday things

Searching the web for current info, drafting and editing text in English or Korean, reading files you upload, planning.

The catch worth knowing: I'm better when you give me real context and push back on me. Vague question in, vague answer out.
What are you actually trying to get done right now?
{"keyword":"My Jobs","question":"What can you do for me?","answer":"It helps you reason and build (coding, system design, explanations), create artifacts like demos, documents, and runnable code, and handle everyday tasks such as web search, editing, and planning — working best with concrete context."}

Example (Korean)
[User] 근데 프로젝트 안에 있는 대화들은 서로 내용이 공유되는건가? 다음 대화에서 이미 했던거를 반복하기가 귀찮아서
[Assistant] 좋은 질문이야. 정확히 구분해서 답할게.
대화끼리 내용이 자동으로 통째로 공유되진 않아. 새 대화를 열면 이전 대화의 메시지들이 그대로 컨텍스트에 실려 오는 건 아니야. 즉 "지난 대화 전문을 내가 다 기억한 채로 시작"하는 건 아니라는 뜻.
하지만 프로젝트 안에서는 세 가지가 대화를 이어줘:

프로젝트 지식(파일) — 이건 모든 대화가 공유해. 그래서 PROGRESS.md의 "다음에 할 일"·"세션 이력" 같은 게 딱 이 반복을 막으려고 있는 거야. 결정·진행 상황을 여기 적어두면 다음 대화의 내가 그대로 읽고 시작해. 가장 확실한 방법.
프로젝트 메모리 — 프로젝트마다 별도 메모리 공간이 있어서, 과거 대화에서 뽑은 내용이 어느 정도 자동으로 넘어와. 단 이건 주기적으로 백그라운드에서 갱신돼서 방금 한 대화는 아직 반영이 안 됐을 수 있고, 전문이 아니라 요약된 형태야. 그래서 "믿고 맡기기"엔 부족해.
과거 대화 검색 — 네가 "지난번에 정한 그거" 식으로 언급하면, 내가 이 프로젝트 안의 과거 대화를 직접 검색해서 찾아올 수 있어. 메모리에 없어도 이걸로 끌어와.

정리하면: 확실하게 반복 안 하려면 → 중요한 결정·상태는 PROGRESS.md에 적어두는 게 정답이야 (메모리·검색은 보조). 네 프로젝트 구조가 이미 그렇게 설계돼 있어서 방향이 맞아.
한 가지 주의: 지금은 프로젝트 지식이 비어 있는 상태라 1번 continuity가 끊겨 있어. 저장소 Sync부터 확실히 돌려서 PROGRESS.md가 다시 들어오게 해두면, 다음 대화부터 반복 없이 이어갈 수 있어.
{"keyword":"프로젝트 내 대화 공유,"question":"Claude.ai 사이트에서 프로젝트 내 세션끼리 대화 내용을 공유할 수 있는가?","answer":"대화 내용이 자동으로 통째로 공유되진 않지만, 프로젝트 안에서는 프로젝트 지식(파일)·프로젝트 메모리·과거 대화 검색이 대화를 이어줍니다. 반복을 확실히 막으려면 중요한 결정과 상태를 PROGRESS.md에 적어두는 것이 가장 확실합니다."}`;

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
    } catch (err) {
      // Malformed or non-JSON output - ignore, let the loop retry
      // fall through to the truncated fallback below
      console.debug('[summary] prompt/parse failed, will retry of fall back:', err, '\nRAW>>>', raw, '<<<');
    }
  }

  return { ok: false, summary: fallbackSummary(question, answer) };
}
