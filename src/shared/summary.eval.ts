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
    id: 'EN-0',
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
    id: 'EN-1',
    lang: 'en',
    question: `Then can you build a code for print 'hello world' in Python?`,
    answer: `python
print("Hello, world!")
That's the whole thing — Python doesn't need a main function or boilerplate. Save it as hello.py and run python hello.py.`,
  },
  {
    id: 'KO-0',
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
  {
    id: 'KO-1',
    lang: 'ko',
    question: `혹시 많이들 사용하는 lut 종류가 있나? 아니면 색감의 분류라던가가 있을까? 어느 상황에 어떤 lut을 사용하는게 좋더라 하는 색감에 대한 이론들이 있을거잖아`,
    answer: `좋은 질문이야. "LUT 종류"로 접근하면 끝이 없으니까, 룩(look)을 만들어내는 몇 개의 레버로 먼저 분해하고, 거기서 유명한 룩들이 어떻게 파생되는지, 그리고 상황별 이론까지 순서대로 갈게. 이게 첫 원리부터 잡는 방식이야.
먼저: 룩은 4~5개 레버의 조합일 뿐
세상의 모든 크리에이티브 LUT은 결국 이 축들을 어떻게 세팅했느냐로 환원돼:

색상 대비 (hue 관계) — 그림자와 하이라이트를 색환에서 어느 방향으로 미느냐. 이게 룩의 정체성 대부분을 결정해.
스플릿 토닝 — 어두운 영역과 밝은 영역에 다른 색을 넣는 것 (예: 따뜻한 하이라이트 + 차가운 그림자).
대비 커브 — S커브(쨍/펀치) ↔ 리프티드 블랙(바랜/매트/필름). 검정을 띄우면 즉시 "빈티지·인디" 느낌.
채도 처리 — 고채도(화려·판타지) ↔ 저채도(거칠·진지·다큐). 선택적 채도(한 색만 남기기)도 여기.
필름 에뮬레이션 — 특정 필름 스톡의 색 응답+그레인+할레이션을 통째로 흉내.

명명된 "룩"들은 이 다섯 개의 특정 조합에 이름표를 붙인 것뿐이야.
이론의 뼈대: 색환 관계
가장 중요한 레버(1번)를 떠받치는 게 색환 이론이야.marketingaccesspassentheoswebstorage.googleapis웹 검색 결과(새 탭에서 열림)
보색 대비 (색환에서 정반대) — 최대의 시각적 긴장·생동감. 틸 앤 오렌지가 이 원리의 화신이야. 사람 피부는 주황 계열인데, 그림자·배경을 반대편인 청록으로 밀면 피부가 배경에서 튀어나와 보여. 블록버스터가 이걸 쓰는 이유.
유사색 (색환에서 인접) — 조화·차분·몰입. 전체를 한 색조로 통일. 무드 있는 아트필름·특정 정서 씬.
단색조(monochromatic) — 하나의 색으로 침잠. 강렬한 분위기 통일.

여기서 핵심 원칙 하나: 피부톤(memory color)은 건드리면 안 돼. 관객은 피부·하늘·나뭇잎 색이 "틀린" 걸 본능적으로 잡아내거든. 틸-오렌지가 먹히는 것도 피부(주황)는 보호하면서 나머지만 청록으로 미는 구조라 그래.
유명한 룩 패밀리와 언제 쓰나
틸 앤 오렌지 — 보색 대비, 피부 강조. 액션·블록버스터·광고·뮤비. "상업적이고 시원한" 기본값.
블리치 바이패스 — 저채도 + 고대비 + 은빛. 거칠고 냉혹하고 진지함. 전쟁물(라이언 일병), 스릴러, 하드보일드.
페이드/매트 (인디 필름) — 검정 띄우고 대비 낮추고 채도 죽임. 몽환적·노스탤직·감성. 인디 드라마, 뮤비, 청춘물. (지난번 "ComingofAge" 룩이 딱 이 계열.)
웜/골든 — 골든아워 따뜻함. 로맨스·향수·안온함·회상 씬. 편안하고 친밀한 정서.
쿨/블루 — 차갑고 고립되고 긴장. SF·스릴러·슬픔·디스토피아·밤 씬. 감정적 거리감.
그린 틴트 — 불안·병듦·부패·도덕적 타락. 호러·범죄·심리물(매트릭스의 초록, 핀처, 브레이킹 배드). 뭔가 잘못됐다는 무의식적 신호.
세피아/빈티지 — 과거·기억·역사. 회상 장면, 시대극.
하이키 파스텔 — 밝고 경쾌·꿈결. 코미디·패션·CF·판타지.
상황 → 색 매핑 (감정 이론)
네가 원하는 "언제 뭘 쓰나"의 핵심은 색-감정 연상이야:

따뜻함(주황/빨강) → 에너지·친밀·향수·정열·(또는)위험. 로맨스·회상·집.
차가움(파랑/청록) → 냉정·슬픔·고립·기술·밤. SF·스릴러·멜랑콜리.
초록 → 부자연·불안·질병·질투. 호러·범죄·심리적 붕괴.
저채도 → 리얼리즘·가혹함·진지함·과거. 전쟁·사회드라마.
고채도 → 활력·판타지·환희·과잉현실. 아동물·뮤지컬·판타지.
대비/채도 = 감정 강도 다이얼. 세게 → 강렬·양식화, 약하게 → 잔잔·자연.

룩을 고를 때의 상위 원칙 세 가지

동기부여된 색(motivated color). 좋은 그레이딩은 임의가 아니라 씬 안에 이유가 있어 — 네온 조명, 차가운 아침, 노을. 이유가 있는 색이 설득력 있어. (네가 만들려는 태양광 씬이면 자연스레 따뜻한 웜 룩이 "동기부여"돼.)
기억색·피부 보호. 스타일을 넣되 피부는 자연스럽게. 여기서 무너지면 다 무너져.
씬 안에선 통일, 씬 사이엔 대비. 지난번 워크플로우 그대로 — 한 씬은 하나의 룩으로 묶고, 씬이 바뀌며 무드를 의도적으로 전환(따뜻한 회상 → 차가운 현재).


정리하면 — "LUT 종류"가 아니라 "색상관계 × 스플릿토닝 × 대비 × 채도"의 조합으로 보면 돼. 유명한 룩들은 그 조합에 이름 붙인 것이고, 고르는 기준은 그 씬이 관객에게 느끼게 하려는 감정이야. 크리에이티브 LUT을 산다는 건 결국 이 조합 하나를 사는 거고, 네가 직접 굽는다는 건 이 레버들을 손으로 돌려보는 거지.
원하면 이 레버들을 노브로 둔 크리에이티브 LUT 생성기(지난번 look() 함수 확장판)를 만들어서, 틸-오렌지나 페이드 같은 룩을 파라미터 몇 개로 뽑아보는 걸로 이론을 손으로 확인해볼래?`,
  }
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
