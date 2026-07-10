// src/shared/summary.eval.ts
// Dev-only evaluation harness for the node-summary prompt (issue #158).
// Runs in the browser against Chrome built-in AI — NOT a Jest test (no LanguageModel in Node).
// Never imported by a shipped entry, so it tree-shakes out of the bundle.
//
// Usage (temporary, during the spike):
//   in src/background/index.ts:
//     import { runSummaryEval } from '@shared/summary.eval';
//     Object.assign(globalThis, { runSummaryEval });   // remove before PR
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
		question: "How do I get a splinter out of my finger?",
		answer: "Clean the area, then pull the splinter out with sterilized tweezers at the same angle it went in; if it's deep, soak the skin in warm water first to loosen it." },
	{ id: 'EN-long', lang: 'en',
		question: "Why do we get jet lag?",
		answer: "Jet lag happens because your internal body clock is still set to your old time zone while the new one is ahead or behind. Your sleep, hunger, and alertness cycles take a few days to resync with local daylight, so you feel tired or wide awake at the wrong times." },
	{ id: 'EN-code', lang: 'en',
		question: "How do I rename a file in the terminal?",
		answer: "Use the mv command: `mv oldname.txt newname.txt`. It renames the file within the same folder." },
	{ id: 'EN-followup', lang: 'en',
		question: "And to move it into another folder?",
		answer: "Give mv a folder as the destination, e.g. `mv newname.txt ~/Documents/`, which relocates the file there." },
	{ id: 'KO-short', lang: 'ko',
		question: "라면 좀 더 맛있게 끓이는 방법 있어?",
		answer: "물이 끓은 뒤 면과 스프를 넣고, 계란은 불을 끄기 직전에 넣어 반숙으로 익히면 국물이 더 진하고 부드러워집니다." },
	{ id: 'KO-long', lang: 'ko',
		question: "시차 적응은 왜 그렇게 힘들어?",
		answer: "몸속 생체시계가 아직 예전 시간대에 맞춰져 있는데 도착지 시간은 다르기 때문입니다. 수면·식욕·각성 리듬이 현지 햇빛에 다시 맞춰지는 데 며칠이 걸려서, 엉뚱한 시간에 졸리거나 잠이 안 오는 것입니다." },
	{ id: 'KO-code', lang: 'ko',
		question: "터미널에서 새 폴더 만드는 명령어 뭐야?",
		answer: "mkdir 명령을 씁니다: `mkdir 폴더이름`. 현재 위치에 그 이름의 폴더가 생깁니다." },
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
