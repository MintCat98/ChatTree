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

### AI Usage Log | 2026-05-29 (By @ignisytb)
- **What**: Implement `injectPanel()` — Shadow DOM mount skeleton (Issue #11)
- **Request**: Issue #11의 injectPanel() 구현 방법 질문 및 Shadow DOM, React, JSX 개념 학습
- **AI Suggestion**: shadowHost guard, closed Shadow DOM 생성, ReactDOM.createRoot() 저장 후 unmount(), .tsx 변환 후 JSX stub 렌더링 방식 제안
- **Human Review**:
    - .tsx 변환 여부 및 React.createElement vs JSX 방식 직접 판단
    - stub 스타일링 단순화 (dark box 스타일 제거)
    - reactRoot 변수 추가 및 unmount() 처리는 리뷰어 피드백 후 직접 반영
- **Reflected**: ui-injector.tsx로 rename, injectPanel()·destroyPanel() 구현 완료, `tsc --noEmit` 및 `npm run build` 성공 확인

---

### AI Usage Log | 2026-05-28 (By @MintCat98)
- **What**: hotfix — `constants.ts` selector fix, `message-types.ts` key rename & `BridgeMessage<T>` wrapper 도입
- **Request**: "아래와 같은 문제가 있었는데 핫픽스 부탁해." (Task spec 전달, 셀렉터 불일치 + 메시지 키 이름 불일치 수정 요청)
- **AI Suggestion**: 4개 파일 수정 플랜 제시 — `constants.ts` (셀렉터 3개 수정·5개 추가·3개 제거), `message-types.ts` (키 2개 리네임·1개 제거·`BridgeMessage<T>` 추가), `message-handler.ts` / `message-bridge.ts` (import 타입 교체)
- **Human Review**:
    - 클로드에 의한 즉시 수정 전, plan을 받아본 뒤 문제 없음 확인 후 진행
    - 수정내용에 대해 직접 npm build를 통해 에러 없음 확인
- **Reflected**: 플랜대로 4개 파일 수정, `tsc --noEmit` 오류 없음, `webpack` 빌드 성공 확인
