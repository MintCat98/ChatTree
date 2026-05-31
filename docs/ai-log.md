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

---

<!-- Start from here -->

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: feat — Issue #14 `message-bridge.ts` 구현
- **Request**: "#14 작업해줘."
- **AI Suggestion**: `sendToBackground` (3회 retry, `Promise<void>`로 시그니처 변경), `onMessageFromBackground` (타입 가드 + cleanup 함수 반환), `isBridgeMessage` 내부 헬퍼 구현. `sleep` 헬퍼 네이밍 개선 제안 수용 → 인라인 처리. unit test 11개 작성
- **Human Review**:
  - `sleep` 함수 이름이 너무 generic하다는 피드백 → 인라인으로 수정
- **Reflected**: `message-bridge.ts` 구현 및 unit test 11개 통과 확인

---

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: feat — Issue #14 `message-bridge.ts` 구현
- **Request**: "#14 작업해줘."
- **AI Suggestion**: `sendToBackground` (3회 retry, `Promise<void>`로 시그니처 변경), `onMessageFromBackground` (타입 가드 + cleanup 함수 반환), `isBridgeMessage` 내부 헬퍼 구현. `sleep` 헬퍼 네이밍 개선 제안 수용 → 인라인 처리. unit test 11개 작성
- **Human Review**:
  - `sleep` 함수 이름이 너무 generic하다는 피드백 → 인라인으로 수정
- **Reflected**: `message-bridge.ts` 구현 및 unit test 11개 통과 확인

---

### AI Usage Log | 2026-05-31 (By @MintCat98)

- **What**: feat — Issue #13 `session-store.ts` 구현, `@background/` alias 설정 추가
- **Request**: "이슈 #13에 대해 컨텍스트 고려해서 작업해줘. 연결된 후속 이슈로는 #14, #15가 있어."
- **AI Suggestion**: 플랜 모드에서 #13~#15 전체 구현 계획 제시. 유저 피드백으로 #13만 진행하기로 축소 — `session-store.ts` (`getTree` / `updateTree` / `clearTree`), `index.ts`에 `tabs.onRemoved` 리스너 추가, `jest.config.js` · `webpack.config.js` · `tsconfig.json` · `tsconfig.test.json` alias 설정, unit test 12개 작성
- **Human Review**:
  - #14, #15는 나중에 진행하기로 결정
  - 확인 없이 커밋 진행한 것에 대해 "멋대로 커밋날리지 마라" 피드백 → 커밋 전 확인 정책 수립
- **Reflected**: `session-store.ts` 구현 및 unit test 12개 통과 확인, `serializeNodes` 리팩터링 및 탭 격리 테스트 추가. 커밋 전 확인 정책 반영

---

### AI Usage Log | 2026-05-28 (By @MintCat98)

- **What**: hotfix — `constants.ts` selector fix, `message-types.ts` key rename & `BridgeMessage<T>` wrapper 도입
- **Request**: "아래와 같은 문제가 있었는데 핫픽스 부탁해." (Task spec 전달, 셀렉터 불일치 + 메시지 키 이름 불일치 수정 요청)
- **AI Suggestion**: 4개 파일 수정 플랜 제시 — `constants.ts` (셀렉터 3개 수정·5개 추가·3개 제거), `message-types.ts` (키 2개 리네임·1개 제거·`BridgeMessage<T>` 추가), `message-handler.ts` / `message-bridge.ts` (import 타입 교체)
- **Human Review**:
  - 클로드에 의한 즉시 수정 전, plan을 받아본 뒤 문제 없음 확인 후 진행
  - 수정내용에 대해 직접 npm build를 통해 에러 없음 확인
- **Reflected**: 플랜대로 4개 파일 수정, `tsc --noEmit` 오류 없음, `webpack` 빌드 성공 확인
