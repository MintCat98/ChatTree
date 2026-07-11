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
  {
    id: 'EN-1',
    lang: 'en',
    question: 'What can you do for me?',
    answer: `Quite a lot — here's the practical shape of it, Taebin:
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
What are you actually trying to get done right now?`,
  },
  {
    id: 'KO-1',
    lang: 'ko',
    question: '근데 프로젝트 안에 있는 대화들은 서로 내용이 공유되는건가? 다음 대화에서 이미 했던거를 반복하기가 귀찮아서',
    answer: `좋은 질문이야. 정확히 구분해서 답할게.
대화끼리 내용이 자동으로 통째로 공유되진 않아. 새 대화를 열면 이전 대화의 메시지들이 그대로 컨텍스트에 실려 오는 건 아니야. 즉 "지난 대화 전문을 내가 다 기억한 채로 시작"하는 건 아니라는 뜻.
하지만 프로젝트 안에서는 세 가지가 대화를 이어줘:

프로젝트 지식(파일) — 이건 모든 대화가 공유해. 그래서 PROGRESS.md의 "다음에 할 일"·"세션 이력" 같은 게 딱 이 반복을 막으려고 있는 거야. 결정·진행 상황을 여기 적어두면 다음 대화의 내가 그대로 읽고 시작해. 가장 확실한 방법.
프로젝트 메모리 — 프로젝트마다 별도 메모리 공간이 있어서, 과거 대화에서 뽑은 내용이 어느 정도 자동으로 넘어와. 단 이건 주기적으로 백그라운드에서 갱신돼서 방금 한 대화는 아직 반영이 안 됐을 수 있고, 전문이 아니라 요약된 형태야. 그래서 "믿고 맡기기"엔 부족해.
과거 대화 검색 — 네가 "지난번에 정한 그거" 식으로 언급하면, 내가 이 프로젝트 안의 과거 대화를 직접 검색해서 찾아올 수 있어. 메모리에 없어도 이걸로 끌어와.

정리하면: 확실하게 반복 안 하려면 → 중요한 결정·상태는 PROGRESS.md에 적어두는 게 정답이야 (메모리·검색은 보조). 네 프로젝트 구조가 이미 그렇게 설계돼 있어서 방향이 맞아.
한 가지 주의: 지금은 프로젝트 지식이 비어 있는 상태라 1번 continuity가 끊겨 있어. 저장소 Sync부터 확실히 돌려서 PROGRESS.md가 다시 들어오게 해두면, 다음 대화부터 반복 없이 이어갈 수 있어.`,
  },
];

const hasHangul = (s: string) => /[가-힣]/.test(s);

interface EvalRow {
  id: string;
  lang: 'en' | 'ko';
  ok: boolean;
  kwLen: number;
  kwOk: boolean;
  langOk: boolean;
  ms: number;
  keyword: string;
  question: string;
  answer: string;
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
    },
  });

  const rows: EvalRow[] = [];
  for (const c of EVAL_SET) {
    const t0 = performance.now();
    const r = await summarizeConversation(session, c.question, c.answer);
    const ms = Math.round(performance.now() - t0);
    if (!r.summary) continue;
    const s = r.summary;
    rows.push({
      id: c.id,
      lang: c.lang,
      ok: r.ok,
      kwLen: s.keyword.length,
      kwOk: s.keyword.length <= KEYWORD_MAX_LENGTH,
      langOk: hasHangul(s.answer) === (c.lang === 'ko'),
      ms,
      keyword: s.keyword,
      answer: s.answer,
      question: s.question,
    });
  }
  console.table(rows);

  const n = rows.length;
  const pct = (k: 'ok' | 'kwOk' | 'langOk') =>
    Math.round((100 * rows.filter((r) => r[k]).length) / n);
  console.log(
    `[eval] ok ${pct('ok')}% · kwOk ${pct('kwOk')}% · langOk ${pct('langOk')}%  (n=${n})`
  );

  session.destroy();
}
