<!-- Format (Just copy and paste to use) -->

> **_Please make sure to list them in descending order._**

### AI Usage Log | 2026-MM-DD (By @Your_GitHub_Username)

- **What**: Draft PR #3 body
- **Request**: "Write a PR body related to the following changes as an Issue"
- **AI Suggestion**: Body containing all 5 elements (linked to Issue #5)
- **Human Review**:
  - Removed "tests passed" — no actual tests were present
  - Corrected Issue number #5 → #4
  - Changed "perfectly" → "working as expected"
- **Reflected**: Final PR body with 4 verified elements + corrected Issue number

<!-- Start from here -->

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: fix — `fix/chatbox-record-failure` 브랜치. 실제 Claude.ai에서 챗박스가 트리에 기록되지 않는 버그 2건 수정 (`observer.ts`, `App.tsx`).
- **Request**: "지금 실제 클로드ai에서 dist를 업로드해서 테스트중인데 ui까지 띄우는 건 성공했지만 chatbox를 기록하지 못하고 있어"
- **AI Suggestion**:
  - DOM 셀렉터 검증: DevTools 콘솔에서 `#main-content`, `[data-user-message-bubble="true"]`, `[data-is-streaming]` 존재 여부 순차 확인 (초기 메인 화면에서 실행한 오해 포함). 채팅 페이지에서 재확인 후 셀렉터 모두 정상임을 확인.
  - **Bug 1** — `observer.ts` `handleDOMChange()`가 `MessageType.CHATBOX_ADDED`로 전송하는데, `message-handler.ts`의 `CHATBOX_ADDED` 케이스는 `break`만 있는 미구현 스텁. `TREE_UPDATE`로 변경하면 기존 핸들러(`updateTree` → `broadcastToTab(TREE_READY)`)가 정상 처리됨.
  - **Bug 2** — `App.tsx`가 `setTree(msg.payload)`를 호출하나 `TREE_READY` payload 구조는 `{ tree: TreeData }`. 결과적으로 `store.tree = { tree: TreeData }`가 되어 `tree.nodes`가 `undefined` → `TreeMapCanvas`에서 `.length` 접근 시 TypeError. `setTree(msg.payload.tree)`로 수정.
  - 중간에 `console.log` 디버그 로그 추가 후 흐름 확인, 이후 제거.
- **Human Review**:
  - 셀렉터 확인 시 메인 화면에서 실행해 false-negative 발생 → 직접 채팅 페이지에서 재실행해 정상 확인.
  - 확장 프로그램 재로드 후 페이지 새로고침이 필요함을 재확인 (content script 재주입 조건).
  - 최종 트리 렌더링 및 `[ChatTree] handleDOMChange fired, nodes: 7` 콘솔 로그로 정상 동작 확인.
- **Reflected**: `src/content/observer.ts` (`CHATBOX_ADDED` → `TREE_UPDATE`, `.catch()` 추가), `src/content/panel/App.tsx` (`msg.payload` → `msg.payload.tree`) 2파일 수정.

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: 디버깅 — 확장프로그램 로드 시 발생한 3종 에러 수정 및 패널 초기 렌더링 연결. (1) webpack dev 빌드의 CSP `unsafe-eval` 위반, (2) `chrome.alarms` 권한 누락으로 인한 TypeError, (3) `ui-injector.tsx` placeholder + `page-watcher.ts` 미구현으로 패널 미표시.
- **Request**: "크롬 개발자모드에서 업로드했는데 CSP 에러 / TypeError / TODO 에러가 뜬다."
- **AI Suggestion**:
  - `webpack.config.js`에 `devtool: 'cheap-source-map'` 추가 → `eval()` 미사용 소스맵으로 CSP 위반 해소.
  - `manifest.json` permissions에 `"alarms"` 추가 → `chrome.alarms` undefined 해소.
  - `ui-injector.tsx` 재작성: `App` 컴포넌트 import + Shadow DOM에 `panel.css?raw` 주입 후 React 루트 마운트.
  - `panel.css` CSS 변수 값 채우기 (`--nav-z-index`, `--nav-border-radius`, `--nav-color-*` 등 전체 TODO → 실제 값).
  - webpack에 `?raw` CSS 룰(`resourceQuery: /raw/`, `type: 'asset/source'`) 추가 + `src/types/css.d.ts`에 `*.css?raw` 타입 선언 추가.
  - `page-watcher.ts` 구현: `history.pushState` 패치 + `popstate` 리스너로 SPA 네비게이션 감지.
- **Human Review**:
  - CSS 하드코딩 대신 CSS 파일 분리 요청 → `ui-injector.tsx`에서 인라인 문자열 대신 `panel.css?raw` import로 변경.
  - 빌드 성공 (`webpack 5.107.1 compiled successfully`), CSP 에러 및 TODO 에러 해소 확인.
- **Reflected**: `webpack.config.js`, `manifest.json`, `ui-injector.tsx`, `panel.css`, `src/types/css.d.ts`, `page-watcher.ts` 6파일 수정.

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: 이슈 #28 / PR #34 — MintCat98 리뷰 코멘트 5건 반영. (1) inline style → `popup.css` 분리, (2) 삭제됐던 `ReactDOM.createRoot` 마운트 복원, (3) `export default` → named `export function Popup` 복원, (4) 불필요한 storage read를 `status === 'supported'`일 때만 로드하도록 게이트, (5) 순수 로직 분리 + 단위 테스트 추가. 코드 주석 전부 영어로 작성.
- **Request**: "MintCat 리뷰 코멘트(스타일 하드코딩 / createRoot 삭제 / export 변경 / storage read / unit test) 반영해서 정확히 수정하고 깃헙에 올릴 수 있게 해줘. 코드 주석은 영어로."
- **AI Suggestion**:
  - 원인 검증: `webpack.config.js`에서 popup entry가 `Popup.tsx` 자신 → 마운트 삭제 시 팝업이 빈 화면. `grep -rn Popup src/` 결과 import 사용처 없음 → named export로 복원해도 안전.
  - `src/popup/popup.css` 신규 + `cn-*` className 전환 (기존 style-loader/css-loader 설정 활용).
  - 순수 로직을 `src/popup/popup-logic.ts`로 분리: `isSupportedPage` / `mergeSettings` / `applyPatch` / `buildSettingsMessage`.
  - `tests/unit/popup-logic.test.ts` 8 케이스 (URL 판별·설정 병합·patch 불변·SETTINGS_CHANGE 메시지 래핑).
  - settings 로드를 `useEffect([status])`로 옮겨 `status === 'supported'`일 때만 `chrome.storage.local.get` 실행.
- **Human Review**:
  - 빌드 중 `TS2882` (CSS side-effect import 타입 부재) 발견 → `src/types/css.d.ts`(`declare module '*.css';`) 추가.
  - `chrome.storage.local.get` 결과 타입이 `unknown` → `mergeSettings(result.settings as Partial<UserSettings> | undefined)`로 캐스팅.
  - `npm run build` 성공, `npm test` 전체 통과(5 suites, 14 passed / 10 todo, 그중 popup-logic 8/8), 신규 4파일 `eslint` 무에러 확인.
  - Dropbox가 `.git`을 실시간 동기화하며 객체 파일을 잠가 `git add` 시 `Permission denied` → `.git`에 `com.dropbox.ignored=1` 설정 + 읽기전용 속성 정리 후 staging 성공.
- **Reflected**: 코드 4파일(`Popup.tsx` 수정 + `popup-logic.ts`·`popup.css`·`types/css.d.ts` 신규) + 테스트 1파일(`tests/unit/popup-logic.test.ts`). Background의 SETTINGS_CHANGE forward / Panel의 수신 처리는 기존 계획대로 후속(#3) 의존.

### AI Usage Log | 2026-05-31 (By @jglJGL000304)

- **What**: 이슈 #28 / PR #34 — MintCat98 리뷰 코멘트 5건 반영. (1) inline style → `popup.css` 분리, (2) 삭제됐던 `ReactDOM.createRoot` 마운트 복원, (3) `export default` → named `export function Popup` 복원, (4) 불필요한 storage read를 `status === 'supported'`일 때만 로드하도록 게이트, (5) 순수 로직 분리 + 단위 테스트 추가. 코드 주석 전부 영어로 작성.
- **Request**: "MintCat 리뷰 코멘트(스타일 하드코딩 / createRoot 삭제 / export 변경 / storage read / unit test) 반영해서 정확히 수정하고 깃헙에 올릴 수 있게 해줘. 코드 주석은 영어로."
- **AI Suggestion**:
  - 원인 검증: `webpack.config.js`에서 popup entry가 `Popup.tsx` 자신 → 마운트 삭제 시 팝업이 빈 화면. `grep -rn Popup src/` 결과 import 사용처 없음 → named export로 복원해도 안전.
  - `src/popup/popup.css` 신규 + `cn-*` className 전환 (기존 style-loader/css-loader 설정 활용).
  - 순수 로직을 `src/popup/popup-logic.ts`로 분리: `isSupportedPage` / `mergeSettings` / `applyPatch` / `buildSettingsMessage`.
  - `tests/unit/popup-logic.test.ts` 8 케이스 (URL 판별·설정 병합·patch 불변·SETTINGS_CHANGE 메시지 래핑).
  - settings 로드를 `useEffect([status])`로 옮겨 `status === 'supported'`일 때만 `chrome.storage.local.get` 실행.
- **Human Review**:
  - 빌드 중 `TS2882` (CSS side-effect import 타입 부재) 발견 → `src/types/css.d.ts`(`declare module '*.css';`) 추가.
  - `chrome.storage.local.get` 결과 타입이 `unknown` → `mergeSettings(result.settings as Partial<UserSettings> | undefined)`로 캐스팅.
  - `npm run build` 성공, `npm test` 전체 통과(5 suites, 14 passed / 10 todo, 그중 popup-logic 8/8), 신규 4파일 `eslint` 무에러 확인.
  - Dropbox가 `.git`을 실시간 동기화하며 객체 파일을 잠가 `git add` 시 `Permission denied` → `.git`에 `com.dropbox.ignored=1` 설정 + 읽기전용 속성 정리 후 staging 성공.
- **Reflected**: 코드 4파일(`Popup.tsx` 수정 + `popup-logic.ts`·`popup.css`·`types/css.d.ts` 신규) + 테스트 1파일(`tests/unit/popup-logic.test.ts`). Background의 SETTINGS_CHANGE forward / Panel의 수신 처리는 기존 계획대로 후속(#3) 의존.

### AI Usage Log | 2026-05-29 (By @jglJGL000304)

- **What**: 이슈 #28 — popup/Popup.tsx 완성. 현재 탭 URL 검사 후 설정 UI 또는 미지원 안내 표시. chrome.storage.local 영속화 + SETTINGS_CHANGE 메시지로 Panel 동기화.
- **Request**: "Popup.tsx를 두 화면(설정 / 미지원)으로 분기. 설정 변경 시 storage + sendMessage 발행."
- **AI Suggestion**:
  - chrome.tabs.query로 활성 탭 URL 확인 → claude.ai/chat/\* 매칭 여부로 화면 분기
  - 설정 컨트롤은 ControlBar와 동일 구조(패널 표시 토글 + 위치/투명도/정렬 + 방향 disabled)
  - 변경 시 chrome.storage.local.set + chrome.runtime.sendMessage(SETTINGS_CHANGE)
  - 초기 마운트 시 chrome.storage.local.get으로 현재 settings 로드, 로딩 중 깜빡임 방지
- **Human Review**: Claude.ai 탭과 다른 탭에서 각각 Popup 열어 분기 확인. 토글 OFF→ON 시 Panel 재등장. 새로고침해도 설정 유지.
- **Reflected**: src/popup/Popup.tsx 덮어쓰기 1파일. Background forward 로직은 #14/#24 의존.

### AI Usage Log | 2026-05-29 (By @jglJGL000304)

- **What**: 이슈 #27 — `data-slot="header"` / `data-slot="controlbar"` 자리를 PanelShell · Header · Tooltip · ControlBar로 교체. 드래그 이동 / 투명도 / 위치 / 정렬 / hover Tooltip 구현. 컴포넌트 4개 신규 + App.tsx를 PanelShell로 래핑.
- **Request**: "드래그는 mousedown=Header(Shadow DOM)·mousemove/up=document로 분리. Tooltip은 hover 300ms 지연 후 Portal 렌더. ControlBar는 updateSettings에 연결. 애니메이션은 #12의 --nav-duration-\* 토큰 사용."
- **AI Suggestion**:
  - PanelShell(위치/투명도/드래그 관리), Header(드래그 핸들+닫기 버튼), Tooltip(300ms 지연+Portal 렌더), ControlBar(방향 disabled/위치/투명도/정렬)
  - 드래그 좌표는 viewport 클램핑(`Math.max/min`)으로 화면 밖 이탈 방지
  - 닫기 버튼은 `updateSettings({ panelVisible: false })`만 호출 (메시지 발행 X)
  - 드래그 offset은 `useRef`(렌더 불필요), 위치는 `useState`(시각 갱신)
- **Human Review**: Mock tree로 드래그·투명도·정렬·Tooltip 시나리오 시각 확인. tsc·build 통과. 닫기 후 재오픈은 #28 Popup이 담당함을 확인.
- **Reflected**: 4 신규 컴포넌트 + App.tsx 래핑. 드래그 좌표 영속화 / Left-Right 방향은 후속 작업. 실제 데이터 흐름은 Background `TREE_READY` 발행 PR 머지 후 자동 연결.

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: feat — Issue #22 브랜치 전환 감지 및 트리 부분 리로드 구현 (`branch-change-watcher.ts` 신규, `chatbox-tracker.ts` · `observer.ts` 수정, unit tests 추가)
- **Request**: "PR#35 작업자가 자리를 비워 Issue #22 후속 구현을 맡게 됨. 의미있는 커밋 단위로 나눠서 작업하고, 구현 후 unit test 및 크롬 개발자 모드 검증 요청." (Issue #22 스펙, 기존 코드베이스 전달)
- **AI Suggestion**: 4-커밋 플랜 제시 — ① `reloadFromNode` 구현 + `BRANCH_CHANGE_DEBOUNCE` 상수 추가, ② `branch-change-watcher.ts` 신규 생성 (characterData MutationObserver, 150ms debounce, 스트리밍 가드), ③ `observer.ts` 배선 (`currentNodes` 추적, `watchBranchChanges` 연결, `stopObserving` cleanup), ④ unit tests 13개 (`chatbox-tracker.test.ts`, `branch-change-watcher.test.ts`)
- **Human Review**:
  - 플랜 검토 후 승인, 커밋은 직접 수행
  - `tsconfig.test.json`에 `"node"` 타입 누락으로 `global` 인식 안 됨 → AI가 추가 수정
- **Reflected**: 모든 unit tests 13개 통과 (`npm test`), 빌드 오류는 기존 `zustand` 미설치로 인한 것으로 변경과 무관함을 확인

### AI Usage Log | 2026-05-30 (By @Do-yun)

- **What**: feat — `observer.ts` 함수 (handleDOMChange, startObserve) 구현 및 `_test-tracker.ts` 수정
- **Request**: "각 함수의 task와 workflow를 제공해줄게. 이를 기반으로, data-is-streaming의 변화가 #main-content 직계자식에서 일어나는지 확인할 방법과 함수의 구현을제안해줘." (Workflow 정리, task 요약본 및 관련 소스코드 전달)
- **AI Suggestion**: observer.ts, \_test-tracker.ts 소스코드 초안 제공 및 data-is-streaming 변화 확인 방법 제안
- **Human Review**:
  - \_test-tracker.ts: 함수 실행만 확인하는 console.log 대신, chrome 환경의 Background에서 메세지를 받은 것을 확인할 수 있도록 수정 요구
  - observer.ts - 구조 분석 및 검토, \_test-tracker.ts를 활용해 검증
- **Reflected**: 제안된 `observer.ts` 및 `_test-tracker.ts` 의 동작을 확인

### AI Usage Log | 2026-05-29 (By @Do-yun)

- **What**: feat — `chatbox-tracker.ts` 함수 (assignChatboxIds, detectBranch, buildTree) 구현 및 `_test-tracker.ts` 수정
- **Request**: "Claude의 DOM의 구조와 각 함수의 task를 제공해줄게. 이를 기반으로, assignChatboxIds, detectBranch, buildTree를 구현해줘." (Claude의 DOM 구조 및 task 요약본 전달)
- **AI Suggestion**: activeBranch, detectBranch, buildTree 소스코드 초안 제공
- **Human Review**:
  - detectBranch - SELECTORS.BRANCH_INDICATOR가 실제와 상이함을 확인하여 수정함. 유저 텍스트의 BRANCH_ACTIONS_WRAPPER보다 하위 element만 search하던 코드를, 같은 깊이의 BRANCH_INDICATOR도 search할 수있도록 유저 텍스트의 부모 element도 모두 수색하도록 변경
  - buildTree - activeBranchPath를 계속 빈칸으로 제공. 이를 존재하는 node들 모두 추가하도록 수정
  - \_test-tracker.ts - Delay가 없을 시 제대로 현재 page 정보를 반영하지 못함을 확인해 수정하도록 지시
- **Reflected**: 제안된 `chatbox-tracker.ts` 및 `_test-tracker.ts` 의 동작을 확인

### AI Usage Log | 2026-05-28 (By @Do-yun)

- **What**: feat — `chatbox-tracker.ts` 체크 및 이를 테스트하기 위한 `_test-tracker.ts` 작성
- **Request**: "이 skeleton 코드를 확인해보고 싶은데, 각 함수의 호출에 문제가 없는지 확인할 수 있는 방법을 제안해줘." (Skeleton 코드 전달)
- **AI Suggestion**: npx tsc--noemit 만 테스트해도 충분 / VSCode의 빨간줄 표시 확인 추천 -> 추가 요청으로, build 후 chrome extension으로 확인 방법 제안
- **Human Review**:
  - 실제 환경에서의 확인과 상이할 수 있음을 지적하고, chrome 환경에서 동작 확인이 될 것을 요구함.
  - 수정된 방식을 사용하고 문제가 없이 의도한대로 됨을 확인
- **Reflected**: 제안된 `_test-tracker.ts` 활용 빌드 성공 및 에러 없이 함수 return이 출력됨을 확인

### AI Usage Log | 2026-05-29 (By @jglJGL000304)

- **What**: 이슈 #25 — `data-slot="treemap"` 자리를 GitLens 스타일 SVG 세로 트리로 교체. 7개 컴포넌트 신규 + App.tsx 한 줄 교체.
- **Request**: "GitLens 브랜치 그래프 스타일. index \* NODE_STEP 단순 좌표, plain SVG, 브랜치 포인트만 점선 레인. D3 사용 X."
- **AI Suggestion**:
  - components/ 폴더에 7개 파일: TreeMapCanvas(컨테이너), TreeNode(원+텍스트), NodeBadge(브랜치 뱃지), NodeConnector(세로선), BranchLane(점선 레인), EmptyState, constants
  - 좌표는 viewBox + `cy = padding + index * step` 으로 결정 (D3 없음)
  - 노드 click → SCROLL_TO_NODE, hover → setHoveredNode, key Enter/Space 처리
  - SVG <text> truncate는 JS로 직접 (CSS text-overflow 동작 X)
- **Human Review**: Mock 데이터로 노드 6개 + 브랜치 포인트 2개 시나리오 시각 확인. tsc·build 통과. Mock import 제거 후 머지 준비.
- **Reflected**: 7 신규 파일 + App.tsx 1줄 교체. Tooltip은 #27에서 추가. 실제 데이터 흐름은 Background `TREE_READY` 발행 PR 머지 후 자동 연결.

### AI Usage Log | 2026-05-28 (By @jglJGL000304)

- **What**: 이슈 #12 리뷰 피드백 반영 — (1) 코드 내 한글 주석 영어로 변환 (`panel-store.ts`, `panel-store.test.ts`, `App.tsx`, `index.css` 4파일), (2) Wn 표기(W4-2, W4-3 등) 제거, (3) PR 본문에서 템플릿 hint 주석(`<!-- ... -->`) 제거, (4) PR 제목을 의미 담은 형태로 교체.
- **Request**: "리뷰 피드백 4가지 반영: Wn 표기 제거 + 템플릿 예시 그대로 두지 말 것 + 코드 주석 영어로 + PR 제목 의미 담기."
- **AI Suggestion**:
  - `panel-store.ts` / `panel-store.test.ts`: 한글 주석을 동일 의미 영문으로 교체. `(W4 Skeleton)` 등 sprint 라벨 제거.
  - `App.tsx`: `data-slot` placeholder 옆 `채워지는 위치: W4-2 / W4-3` 표기를 `Filled by a follow-up component PR`로 일반화.
  - `index.css`: 라이트 모드 후속 처리 문구에서 `W4-3` 표기 제거 → `can be added later if light-mode support becomes required`.
  - `PR본문_복붙용.md`: 본문의 `<!-- ... -->` HTML 주석 가이드 모두 제거. 본문 Wn 표기 일반화. 제목 3안 제시.
- **Human Review**: 4파일 복사 후 `npx tsc --noEmit` / `npm test -- panel-store` / `npm run build` 모두 재통과 확인. PR 제목·본문은 GitHub에서 직접 교체.
- **Reflected**: 코드 4파일 + PR 메타데이터(제목·본문) 갱신. Re-request review 발송.

### AI Usage Log | 2026-05-28 (By @jglJGL000304)

- **What**: Panel UI Skeleton 블로커 ③ — `src/content/panel/index.css` 신규 생성. Shadow DOM `:host`에 디자인 토큰 11종 정의 (배경/노드 5색/엣지/텍스트/테두리/폰트/레이아웃/애니메이션) + `prefers-reduced-motion` 미디어 쿼리로 접근성 보강.
- **Request**: "이슈 #12 본문의 index.css 코드 그대로 `src/content/panel/index.css`로 신규 생성. 다크 모드(Claude.ai 기본 테마) 기준."
- **AI Suggestion**:
  - `:host` 한 블록에 토큰 11종: `--nav-color-bg`, `--nav-color-node` 5종(기본/active/branch/hover/inactive), `--nav-color-edge`, `--nav-color-text` 2종, `--nav-color-border`, `--nav-font-*` 3종, `--nav-border-radius`, `--nav-panel-shadow`, `--nav-z-index`, `--nav-duration-*` 3종
  - `@media (prefers-reduced-motion: reduce)` 블록으로 `--nav-duration-*` 0ms 오버라이드
  - prefix `--nav-`로 충돌 회피, `--nav-z-index: 2147483647` (max int)으로 모달 가림 방지
- **Human Review**:
  - 마운트 코드의 import 사이트 점검 — `Get-ChildItem -Path src` 검색 결과 (결과에 맞게 기술: "이미 import됨" / "panel.css만 있음 → import 추가" / "마운트 코드 부재 → W3-1 머지 대기")
  - 기존 `styles/panel.css`는 미정리(별도 PR). 변수명 prefix가 다르므로 충돌 없음
  - CSS 파일이라 tsc/jest 영향 없음
- **Reflected**: `src/content/panel/index.css` 신규 1파일 + (해당되면) 마운트 파일 import 한 줄.

### AI Usage Log | 2026-05-28 (By @jglJGL000304)

- **What**: Panel UI Skeleton 블로커 ② — `App.tsx`에 `chrome.runtime.onMessage` `TREE_READY` 리스너 shell + `data-slot` placeholder 3개 (header/treemap/controlbar) 추가. default export로 전환.
- **Request**: "이슈 #12 본문의 App.tsx 코드 그대로 `src/content/panel/App.tsx`에 반영. useEffect 안 리스너 + cleanup + panelVisible 가드 + data-slot placeholder 구조."
- **AI Suggestion**:
  - `useEffect`에서 `chrome.runtime.onMessage.addListener(handler)` 등록, return 함수에서 `removeListener`로 cleanup (React strict mode 이중 등록 방지)
  - `handler`는 `msg.type === MessageType.TREE_READY && msg.payload`일 때만 `setTree(msg.payload)` 호출
  - `settings.panelVisible === false`면 `return null` (리스너는 useEffect 안이라 등록은 유지)
  - 본문은 `<div data-testid="panel-root">` + `data-slot="header" | "treemap" | "controlbar"` placeholder
- **Human Review**:
  - default export 전환으로 인한 import 사이트 영향 점검 — `Get-ChildItem` 으로 named import 사용처 검색 후 (있으면) 동일 commit에서 수정
  - `npx tsc --noEmit` 무에러 확인
  - `PanelShell` import 제거됨 — 컴포넌트 파일은 보존 (W4-3 PanelShell 드래그 작업에서 부활)
- **Reflected**: `src/content/panel/App.tsx` 1파일 + (해당되면) import 사이트 1~2파일.

### AI Usage Log | 2026-05-28 (By @jglJGL000304)

- **What**: Panel UI Skeleton 블로커 ① — `panel-store.ts` Zustand store 액션 완성 + `persist` 미들웨어 + 단위 테스트 6 케이스 + `UserSettings.summaryEnabled` 필드 추가 + `zustand` / `jest-environment-jsdom` 의존성 도입.
- **Request**: "이슈 #12 본문의 `panel-store.ts` 코드 그대로 `src/content/panel/store/`에 반영하고, AC 6항목과 1:1 대응되는 단위 테스트를 작성해줘. `tsc --noEmit` 및 `jest` 통과 가능하도록."
- **AI Suggestion**:
  - `src/content/panel/store/panel-store.ts` — `setTree` / `updateSettings` / `setActiveNode` / `setHoveredNode` 4개 액션 본문 + `persist` 미들웨어 + `partialize: s => ({ settings: s.settings })` 로 `settings`만 localStorage 영속화 (tree는 페이지 로드마다 DOM 재구성이므로 제외).
  - `tests/unit/panel-store.test.ts` — AC 6항목 각각 1:1 대응 케이스, `usePanelStore.setState`로 테스트 격리, `/** @jest-environment jsdom */` docblock으로 localStorage 접근 가능.
  - 인접 변경: `src/shared/types.ts` `UserSettings`에 `summaryEnabled: boolean` 필드 추가 (이슈 #12 본문 `DEFAULT_SETTINGS` 명세 매칭, 없으면 `tsc` 에러).
- **Human Review**:
  - 이슈 본문 코드와 1:1 일치 확인 후 적용.
  - `Cannot find module 'zustand'` 에러 → `npm install zustand` 실행.
  - 테스트 파일을 colocated(`src/.../store/`)에 두니 `No tests found` (팀 jest `testMatch=tests/unit/**`만 인식) → `tests/unit/`로 이동 + relative import 경로 `../../src/content/panel/store/panel-store`로 수정.
  - `ReferenceError: localStorage is not defined` → Jest 28+ jsdom 환경 분리 → `npm install -D jest-environment-jsdom` + 테스트 파일 최상단 docblock 추가.
  - 최종 `npm test -- panel-store` 6/6 passed, `npx tsc --noEmit` 무에러 확인.
- **Reflected**: 변경 파일 3개(`panel-store.ts`, `panel-store.test.ts`, `types.ts`) + 의존성 2개(`zustand`, `jest-environment-jsdom`) 도입.

### AI Usage Log | 2026-05-31 (By @ignisytb)

- **What**: Implement `scrollToNode()` — scroll navigation with highlight effect (Issue #24)
- **Request**: Issue #24의 scroll-navigator.ts 구현 순서 질문 및 navId, querySelector, classList, highlight 개념 학습
- **AI Suggestion**: querySelector로 data-nav-id 요소 탐색, scrollIntoView smooth, nav-highlight 클래스 1.5s 후 제거, content_styles.css 생성 및 manifest 등록 방식 제안
- **Human Review**:
  - 코드 직접 작성, 순서 안내만 참고
  - webpack.config.js 수정은 범위 초과로 직접 판단하여 Known Limitations으로 처리
  - content_styles.css staging 여부 직접 결정
  - 리뷰어 피드백 반영: .nav-highlight 선택자를 [data-nav-id].nav-highlight로 변경, console.warn 추가, 불필요 주석 제거
- **Reflected**: scrollToNode() 구현 완료, content_styles.css 생성, manifest.json css 등록, 리뷰 피드백 반영, `npm run build` 성공 확인

### AI Usage Log | 2026-05-30 (By @ignisytb)

- **What**: Implement `startTracking()`, `stopTracking()`, `observeNode()` — IntersectionObserver active node tracking (Issue #23)
- **Request**: Issue #23의 active-node-tracker.ts 구현 방법 질문 및 IntersectionObserver, throttle, Map 상태 관리 개념 학습
- **AI Suggestion**: IntersectionObserver + visibleNodes Map 구조, throttle 50ms, observeNode() export, stopTracking()에서 clearTimeout 처리 방식 제안
- **Human Review**:
  - throttle 없이 먼저 구현 후 직접 추가
  - observeNode() export 필요성 직접 판단 후 추가
  - intersectionObserver 모듈 변수 미할당 버그 직접 발견 및 수정
- **Reflected**: startTracking()·stopTracking()·observeNode() 구현 완료, `tsc --noEmit` 및 `npm run build` 성공 확인

### AI Usage Log | 2026-05-29 (By @ignisytb)

- **What**: Implement `injectPanel()` — Shadow DOM mount skeleton (Issue #11)
- **Request**: Issue #11의 injectPanel() 구현 방법 질문 및 Shadow DOM, React, JSX 개념 학습
- **AI Suggestion**: shadowHost guard, closed Shadow DOM 생성, ReactDOM.createRoot() 저장 후 unmount(), .tsx 변환 후 JSX stub 렌더링 방식 제안
- **Human Review**:
  - .tsx 변환 여부 및 React.createElement vs JSX 방식 직접 판단
  - stub 스타일링 단순화 (dark box 스타일 제거)
  - reactRoot 변수 추가 및 unmount() 처리는 리뷰어 피드백 후 직접 반영
  - 리뷰어 피드백 반영: shadowRoot 불필요 변수 제거, `if (shadowHost) return` → `destroyPanel()` 호출로 변경
- **Reflected**: ui-injector.tsx로 rename, injectPanel()·destroyPanel() 구현 완료, 리뷰 피드백 2건 반영, `tsc --noEmit` 및 `npm run build` 성공 확인

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: feat — Issue #15 `message-handler.ts` 구현, `TREE_UPDATE` 메시지 타입 추가, SW keepalive 등록
- **Request**: "#15 작업하자."
- **AI Suggestion**: `TREE_UPDATE` message-types.ts 추가, `message-handler.ts` 전체 재작성 (7개 MessageType 처리 + `broadcastToTab` 헬퍼), `index.ts`에 `chrome.alarms` keepalive 추가, unit test 16개 작성
- **Human Review**:
  - 특이사항 없음
- **Reflected**: `message-handler.ts` 구현 및 unit test 16개 통과 확인. 전체 test suite 50개 통과

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: feat — Issue #14 `message-bridge.ts` 구현
- **Request**: "#14 작업해줘."
- **AI Suggestion**: `sendToBackground` (3회 retry, `Promise<void>`로 시그니처 변경), `onMessageFromBackground` (타입 가드 + cleanup 함수 반환), `isBridgeMessage` 내부 헬퍼 구현. `sleep` 헬퍼 네이밍 개선 제안 수용 → 인라인 처리. JSDoc 경고 추가. unit test 11개 작성
- **Human Review**:
  - `sleep` 함수 이름이 너무 generic하다는 피드백 → 인라인으로 수정
  - 무차별 retry / lingering timer / JSDoc 경고 필요성 코드 리뷰 피드백 → JSDoc만 반영, 나머지는 MVP 범위 외로 판단
- **Reflected**: `message-bridge.ts` 구현 및 unit test 11개 통과 확인

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: feat — Issue #13 `session-store.ts` 구현, `@background/` alias 설정 추가
- **Request**: "이슈 #13에 대해 컨텍스트 고려해서 작업해줘. 연결된 후속 이슈로는 #14, #15가 있어."
- **AI Suggestion**: 플랜 모드에서 #13~#15 전체 구현 계획 제시. 유저 피드백으로 #13만 진행하기로 축소 — `session-store.ts` (`getTree` / `updateTree` / `clearTree`), `index.ts`에 `tabs.onRemoved` 리스너 추가, `jest.config.js` · `webpack.config.js` · `tsconfig.json` · `tsconfig.test.json` alias 설정, unit test 12개 작성
- **Human Review**:
  - #14, #15는 나중에 진행하기로 결정
  - 확인 없이 커밋 진행한 것에 대해 "멋대로 커밋날리지 마라" 피드백 → 커밋 전 확인 정책 수립
- **Reflected**: `session-store.ts` 구현 및 unit test 12개 통과 확인, `serializeNodes` 리팩터링 및 탭 격리 테스트 추가. 커밋 전 확인 정책 반영

### AI Usage Log | 2026-05-28 (By @MintCat98)

- **What**: hotfix — `constants.ts` selector fix, `message-types.ts` key rename & `BridgeMessage<T>` wrapper 도입
- **Request**: "아래와 같은 문제가 있었는데 핫픽스 부탁해." (Task spec 전달, 셀렉터 불일치 + 메시지 키 이름 불일치 수정 요청)
- **AI Suggestion**: 4개 파일 수정 플랜 제시 — `constants.ts` (셀렉터 3개 수정·5개 추가·3개 제거), `message-types.ts` (키 2개 리네임·1개 제거·`BridgeMessage<T>` 추가), `message-handler.ts` / `message-bridge.ts` (import 타입 교체)
- **Human Review**:
  - 클로드에 의한 즉시 수정 전, plan을 받아본 뒤 문제 없음 확인 후 진행
  - 수정내용에 대해 직접 npm build를 통해 에러 없음 확인
- **Reflected**: 플랜대로 4개 파일 수정, `tsc --noEmit` 오류 없음, `webpack` 빌드 성공 확인
