// src/shared/summary.eval.ts
// Dev-only evaluation harness for the node-summary prompt (issue #158).
// Runs in the browser against Chrome built-in AI — NOT a Jest test (no LanguageModel in Node).
// Never imported by a shipped entry, so it tree-shakes out of the bundle.
//
// Usage (temporary, during the spike):
//   in src/background/index.ts:
//     import { runSummaryEval } from '@shared/summary.eval';
//     (globalThis as any).runSummaryEval = runSummaryEval;   // remove before PR
//   then in the SW DevTools console:  await runSummaryEval();

import { SUMMARY_SYSTEM_PROMPT, KEYWORD_MAX_LENGTH, summarizeConversation } from './summary';

interface EvalEpisode {
	id: string;
	lang: 'en' | 'ko';
	question: string;
	answer: string;
}

const EVAL_SET: EvalEpisode[] = [
	{ id: 'EN-short', lang: 'en',
		question: "What's the difference between let and const in JavaScript?",
		answer: "Both are block-scoped, but const can't be reassigned after initialization while let can. const doesn't make objects immutable — only the binding." },
	{ id: 'EN-long', lang: 'en',
		question: "How does HTTPS keep a connection secure?",
		answer: "HTTPS runs HTTP over TLS. The client and server do a handshake: the server presents a certificate proving its identity, they derive a shared symmetric key using asymmetric cryptography, and all further traffic is encrypted with it. This gives confidentiality, integrity, and authentication so an observer can't read or tamper with the data." },
	{ id: 'EN-code', lang: 'en',
		question: "How do I debounce a function in JavaScript?",
		answer: "Wrap it so it fires after a pause: function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; } Each call resets the timer." },
	{ id: 'EN-followup', lang: 'en',
		question: "And the async version?",
		answer: "Return an async wrapper that awaits fn; the debounce timer still controls when it starts, not when it resolves." },
	{ id: 'KO-short', lang: 'ko',
		question: "파이썬 리스트랑 튜플 차이가 뭐야?",
		answer: "리스트는 수정 가능하고 튜플은 불변입니다. 그래서 튜플이 조금 더 빠르고 딕셔너리 키로도 쓸 수 있습니다." },
	{ id: 'KO-long', lang: 'ko',
		question: "HTTPS는 어떻게 연결을 안전하게 유지해?",
		answer: "HTTPS는 HTTP를 TLS 위에서 실행합니다. 먼저 핸드셰이크로 서버가 인증서를 제시해 신원을 증명하고, 비대칭 암호로 공유 대칭키를 만든 뒤 이후 트래픽을 그 키로 암호화합니다. 덕분에 기밀성·무결성·인증이 보장돼 관찰자가 내용을 읽거나 변조할 수 없습니다." },
	{ id: 'KO-code', lang: 'ko',
		question: "자바스크립트에서 배열 중복 제거 어떻게 해?",
		answer: "Set을 쓰면 됩니다: [...new Set(arr)]. 원시값 기준으로 중복이 제거됩니다." },
];

const hasHangul = (s: string) => /[가-힣]/.test(s);
const roughSentences = (s: string) => (s.match(/[.!?。…]+/g) ?? []).length || 1;

interface EvalRow {
	id: string; lang: 'en' | 'ko'; ok: boolean;
	kwLen: number; kwOk: boolean; langOk: boolean;
	aSents: number; ms: number;
	keyword: string; answer: string;
}

export async function runSummaryEval(): Promise<void> {
	const availability = await LanguageModel.availability();
	console.log('[eval] availability:', availability);
	if (availability === 'unavailable') {
		console.warn('[eval] built-in AI unavailable — cannot evaluate on this machine');
		return;
	}

	const session = await LanguageModel.create({
		initialPrompts: [{ role: 'system', content: SUMMARY_SYSTEM_PROMPT }],
		monitor(m) {
			m.addEventListener('downloadprogress', (e) => {
				const { loaded, total } = e as ProgressEvent;
				console.log('[eval] model download', loaded, '/', total);
			});
		}
	});

	const rows: EvalRow[] = [];
	for (const c of EVAL_SET) {
		const t0 = performance.now();
		const r = await summarizeConversation(session, c.question, c.answer);
		const ms = Math.round(performance.now() - t0);
		if (!r.summary) continue;
		const s = r.summary;
		rows.push({
			id: c.id, lang: c.lang,
			ok: r.ok,
			kwLen: s.keyword.length,
			kwOk: s.keyword.length <= KEYWORD_MAX_LENGTH,
			langOk: hasHangul(s.answer) === (c.lang === 'ko'),
			aSents: roughSentences(s.answer),
			ms,
			keyword: s.keyword,
			answer: s.answer,
		});
	}
	console.table(rows);

	const n = rows.length;
	const pct = (k: 'ok' | 'kwOk' | 'langOk') =>
		Math.round((100 * rows.filter((r) => r[k]).length) / n);
	console.log(`[eval] ok ${pct('ok')}% · kwOk ${pct('kwOk')}% · langOk ${pct('langOk')}%  (n=${n})`);

	session.destroy();
}
