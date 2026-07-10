
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
export const SUMMARY_SYSTEM_PROMPT = `Summarize a conversation (a user question and the assistant\'s answer)

Output rules:
- Output ONLY one valid JSON object.
- Respond in the SAME language as the conversation.
- "keyword": a short noun phrase for the node label, at most ${KEYWORD_MAX_LENGTH} characters.
- "question": 1 sentence summarizing what the user asked.
- "answer": 1~2 sentences summarizing the assistant's answer.

JSON shape: {"keyword": string, "question": string, "answer": string}`;

// Built-in AI user conversation input format
export function buildConversationInput(question: string, answer: string): string {
	return `[User] ${question}\n[Assistant] ${answer}`;
}

// Built-in AI response format
export interface SummaryResult {
	ok: boolean;
	summary: NodeSummary | null;
}