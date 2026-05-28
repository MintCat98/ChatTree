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
- **What**: Panel UI Skeleton 블로커 ① — panel-store.ts 액션 완성 + persist + 단위 테스트
- **Request**: "이슈 #12 본문의 panel-store.ts 코드 그대로 반영 + AC 1:1 테스트 작성"
- **AI Suggestion**:
    - panel-store.ts: 4 액션 + persist + partialize(settings only)
    - tests/unit/panel-store.test.ts: AC 6항목 1:1 케이스 + jsdom docblock
    - 인접 변경: shared/types.ts에 summaryEnabled 필드 추가
- **Human Review**:
    - zustand 미설치 → npm install
    - 테스트 위치 오류 → tests/unit/으로 이동
    - localStorage 미정의 → jest-environment-jsdom 설치 + docblock
    - 6/6 passed, tsc clean
- **Reflected**: 3파일 + 2의존성 도입.
