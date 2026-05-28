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

### AI Usage Log | 2026-05-28 (By @MintCat98)
- **What**: hotfix — `constants.ts` selector fix, `message-types.ts` key rename & `BridgeMessage<T>` wrapper 도입
- **Request**: "아래와 같은 문제가 있었는데 핫픽스 부탁해." (Task spec 전달, 셀렉터 불일치 + 메시지 키 이름 불일치 수정 요청)
- **AI Suggestion**: 4개 파일 수정 플랜 제시 — `constants.ts` (셀렉터 3개 수정·5개 추가·3개 제거), `message-types.ts` (키 2개 리네임·1개 제거·`BridgeMessage<T>` 추가), `message-handler.ts` / `message-bridge.ts` (import 타입 교체)
- **Human Review**:
    - 클로드에 의한 즉시 수정 전, plan을 받아본 뒤 문제 없음 확인 후 진행
    - 수정내용에 대해 직접 npm build를 통해 에러 없음 확인
- **Reflected**: 플랜대로 4개 파일 수정, `tsc --noEmit` 오류 없음, `webpack` 빌드 성공 확인

### AI Usage Log | 2026-05-28 (By @Do-yun)
- **What**: feat — `chatbox-tracker.ts` 체크 및 이를 테스트하기 위한 `_test-tracker.ts` 작성
- **Request**: "이 skeleton 코드를 확인해보고 싶은데, 각 함수의 호출에 문제가 없는지 확인할 수 있는 방법을 제안해줘." (Skeleton 코드 전달)
- **AI Suggestion**: npx tsc--noemit 만 테스트해도 충분 / VSCode의 빨간줄 표시 확인 추천 -> 추가 요청으로, build 후 chrome extension으로 확인 방법 제안
- **Human Review**:
    - 실제 환경에서의 확인과 상이할 수 있음을 지적하고, chrome 환경에서 동작 확인이 될 것을 요구함.
    - 수정된 방식을 사용하고 문제가 없이 의도한대로 됨을 확인
- **Reflected**: 제안된 `_test-tracker.ts` 활용 빌드 성공 및 에러 없이 함수 return이 출력됨을 확인
