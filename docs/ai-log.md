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
### AI Usage Log | 2026-05-30 (By @Do-yun)
- **What**: feat — `observer.ts` 함수 (handleDOMChange, startObserve) 구현 및 `_test-tracker.ts` 수정
- **Request**: "각 함수의 task와 workflow를 제공해줄게. 이를 기반으로, data-is-streaming의 변화가 #main-content 직계자식에서 일어나는지 확인할 방법과 함수의 구현을제안해줘." (Workflow 정리, task 요약본 및 관련 소스코드 전달)
- **AI Suggestion**: observer.ts, _test-tracker.ts 소스코드 초안 제공 및 data-is-streaming 변화 확인 방법 제안
- **Human Review**:
    - _test-tracker.ts: 함수 실행만 확인하는 console.log 대신, chrome 환경의 Background에서 메세지를 받은 것을 확인할 수 있도록 수정 요구
    - observer.ts - 구조 분석 및 검토, _test-tracker.ts를 활용해 검증
- **Reflected**: 제안된 `observer.ts` 및 `_test-tracker.ts` 의 동작을 확인

### AI Usage Log | 2026-05-29 (By @Do-yun)
- **What**: feat — `chatbox-tracker.ts` 함수 (assignChatboxIds, detectBranch, buildTree) 구현 및 `_test-tracker.ts` 수정
- **Request**: "Claude의 DOM의 구조와 각 함수의 task를 제공해줄게. 이를 기반으로, assignChatboxIds, detectBranch, buildTree를 구현해줘." (Claude의 DOM 구조 및 task 요약본 전달)
- **AI Suggestion**: activeBranch, detectBranch, buildTree 소스코드 초안 제공
- **Human Review**:
    - detectBranch - SELECTORS.BRANCH_INDICATOR가 실제와 상이함을 확인하여 수정함. 유저 텍스트의 BRANCH_ACTIONS_WRAPPER보다 하위 element만 search하던 코드를, 같은 깊이의 BRANCH_INDICATOR도 search할 수있도록 유저 텍스트의 부모 element도 모두 수색하도록 변경
    - buildTree - activeBranchPath를 계속 빈칸으로 제공. 이를 존재하는 node들 모두 추가하도록 수정
    - _test-tracker.ts - Delay가 없을 시 제대로 현재 page 정보를 반영하지 못함을 확인해 수정하도록 지시
- **Reflected**: 제안된 `chatbox-tracker.ts` 및 `_test-tracker.ts` 의 동작을 확인

### AI Usage Log | 2026-05-28 (By @Do-yun)
- **What**: feat — `chatbox-tracker.ts` 체크 및 이를 테스트하기 위한 `_test-tracker.ts` 작성
- **Request**: "이 skeleton 코드를 확인해보고 싶은데, 각 함수의 호출에 문제가 없는지 확인할 수 있는 방법을 제안해줘." (Skeleton 코드 전달)
- **AI Suggestion**: npx tsc--noemit 만 테스트해도 충분 / VSCode의 빨간줄 표시 확인 추천 -> 추가 요청으로, build 후 chrome extension으로 확인 방법 제안
- **Human Review**:
    - 실제 환경에서의 확인과 상이할 수 있음을 지적하고, chrome 환경에서 동작 확인이 될 것을 요구함.
    - 수정된 방식을 사용하고 문제가 없이 의도한대로 됨을 확인
- **Reflected**: 제안된 `_test-tracker.ts` 활용 빌드 성공 및 에러 없이 함수 return이 출력됨을 확인

### AI Usage Log | 2026-05-28 (By @MintCat98)
- **What**: hotfix — `constants.ts` selector fix, `message-types.ts` key rename & `BridgeMessage<T>` wrapper 도입
- **Request**: "아래와 같은 문제가 있었는데 핫픽스 부탁해." (Task spec 전달, 셀렉터 불일치 + 메시지 키 이름 불일치 수정 요청)
- **AI Suggestion**: 4개 파일 수정 플랜 제시 — `constants.ts` (셀렉터 3개 수정·5개 추가·3개 제거), `message-types.ts` (키 2개 리네임·1개 제거·`BridgeMessage<T>` 추가), `message-handler.ts` / `message-bridge.ts` (import 타입 교체)
- **Human Review**:
    - 클로드에 의한 즉시 수정 전, plan을 받아본 뒤 문제 없음 확인 후 진행
    - 수정내용에 대해 직접 npm build를 통해 에러 없음 확인
- **Reflected**: 플랜대로 4개 파일 수정, `tsc --noEmit` 오류 없음, `webpack` 빌드 성공 확인


