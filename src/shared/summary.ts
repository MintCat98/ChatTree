const MAX_ATTEMPTS = 2; // initial + one retry

// Built-in AI response format format
export interface NodeSummary {
	keyword: string; // Nodel Label
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
- Respond in the SAME language as the conversation.
- "keyword": a short noun phrase for the node label, at most ${KEYWORD_MAX_LENGTH} characters.
- "question": 1 sentence summarizing what the user asked.
- "answer": 1~2 sentences summarizing the assistant's answer.

JSON shape: {"keyword": string, "question": string, "answer": string}

Example (English)
[User] What does Python's enumerate() do?
[Assistant] It lets you loop over an iterable while getting both the index and the value of each item, so you don't need a manual counter.
{"keyword":"enumerate()","question":"What does Python's enumerate() do?","answer":"It yields each item's index and value while looping, so you don't need a manual counter."}

Example (Korean)
[User] 파이썬 리스트랑 튜플 차이가 뭐야?
[Assistant] 리스트는 수정 가능하고 튜플은 한 번 만들면 못 바꿉니다. 그래서 튜플이 약간 더 빠르고 딕셔너리 키로도 쓸 수 있습니다.
{"keyword":"리스트 vs 튜플","question":"파이썬 리스트와 튜플의 차이는?","answer":"리스트는 수정 가능하지만 튜플은 불변이라, 더 빠르고 딕셔너리 키로도 쓸 수 있습니다."}`;

// Built-in AI user conversation input format
export function buildConversationInput(question: string, answer: string): string {
	return `[User] ${question}\n[Assistant] ${answer}`;
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
		typeof o.keyword === 'string' && o.keyword.length > 0 &&
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
	return t.length <= n ? t : t.slice(0, n-1) + '...';
}

function fallbackSummary(question: string, answer: string): NodeSummary {
	return {
		keyword: truncate(question, KEYWORD_MAX_LENGTH),
		question: truncate(question, 120), // declaration later
		answer: truncate(answer, 200), // declaration later
	}
}

export async function summarizeConversation(
	session: LanguageModelSession,
	question: string,
	answer: string,
): Promise<SummaryResult> {
	const input = buildConversationInput(question, answer);
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		try {
			const raw = await session.prompt(input, { responseConstraint: NODE_SUMMARY_SCHEMA });
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
			console.debug('[summary] prompt/parse failed, will retry of fall back:', err);
		}
	}

	return { ok: false, summary: fallbackSummary(question, answer) };
}