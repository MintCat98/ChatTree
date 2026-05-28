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
- **Reflected**: `src/content/panel/App.tsx` 1파일 + (해당되면) import 사이트 1~2파일. DevTools 콘솔 TREE_READY 검증은 블로커 ③까지 끝나고 일괄 실시.
