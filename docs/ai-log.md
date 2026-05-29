<!-- Format (Just copy and paste to use) -->

> ***Please make sure to list them in descending order.***

### AI Usage Log | 2026-MM-DD (By @Your_GitHub_Username)
- **What**: Draft PR #3 body
- **Request**: "Write a PR body related to the following changes as an Issue"
- **AI Suggestion**: Body containing all 5 elements (linked to Issue #5)
- **Human Review**:
    - Removed "tests passed" — no actual tests were present
    - Corrected Issue number #5 → #4
    - Changed "perfectly" → "working as expected"
- **Reflected**: Final PR body with 4 verified elements + corrected Issue number

---

<!-- Start from here -->


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


### AI Usage Log | 2026-05-28 (By @MintCat98)
- **What**: hotfix — `constants.ts` selector fix, `message-types.ts` key rename & `BridgeMessage<T>` wrapper 도입
- **Request**: "아래와 같은 문제가 있었는데 핫픽스 부탁해." (Task spec 전달, 셀렉터 불일치 + 메시지 키 이름 불일치 수정 요청)
- **AI Suggestion**: 4개 파일 수정 플랜 제시 — `constants.ts` (셀렉터 3개 수정·5개 추가·3개 제거), `message-types.ts` (키 2개 리네임·1개 제거·`BridgeMessage<T>` 추가), `message-handler.ts` / `message-bridge.ts` (import 타입 교체)
- **Human Review**:
    - 클로드에 의한 즉시 수정 전, plan을 받아본 뒤 문제 없음 확인 후 진행
    - 수정내용에 대해 직접 npm build를 통해 에러 없음 확인
- **Reflected**: 플랜대로 4개 파일 수정, `tsc --noEmit` 오류 없음, `webpack` 빌드 성공 확인