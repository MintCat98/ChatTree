# Claude.ai DOM Analysis

> **Status:** Verified as of 2025-06  
> **Target:** `claude.ai/chat/*`  
> **Purpose:** Content Script의 챗박스 감지·추적 및 브랜치 탐지를 위한 DOM 셀렉터 참조

---

## 1. 페이지 구조 개요

```
<body>
  └── #__next  (Next.js root)
       └── main
            └── div[data-testid="conversation-container"]   ← 대화 전체 컨테이너
                 ├── div[data-testid="human-turn"]          ← 유저 챗박스 (N개)
                 │    ├── div[data-testid="user-message"]   ← 프롬프트 텍스트
                 │    └── div.branch-controls               ← 브랜치 네비게이터 (수정 시)
                 └── div[data-testid="assistant-turn"]      ← AI 응답 (N개)
                      └── div[data-testid="ai-response"]
```

---

## 2. 핵심 셀렉터 목록

### 2-1. 대화 컨테이너

| 역할 | 셀렉터 | 비고 |
|------|--------|------|
| 전체 대화 래퍼 | `[data-testid="conversation-container"]` | MutationObserver 루트 |
| 스크롤 영역 | `div.overflow-y-auto` (컨테이너 내부 첫 번째) | `scrollIntoView` 타겟 |

### 2-2. 유저 챗박스 (Human Turn)

| 역할 | 셀렉터 | 비고 |
|------|--------|------|
| 유저 턴 래퍼 | `[data-testid="human-turn"]` | 챗박스 1개 단위 |
| 프롬프트 텍스트 | `[data-testid="user-message"] p` | 요약 AI 인풋 소스 |
| 편집 버튼 | `button[aria-label="Edit message"]` | hover 시 노출 |
| 편집 텍스트에어리어 | `textarea[data-testid="message-input"]` | 편집 모드 진입 후 |

### 2-3. 브랜치 컨트롤 (Branch Navigation)

> 유저가 메시지를 수정·재전송하면 `human-turn` 내부에 아래 요소들이 동적으로 삽입됩니다.

| 역할 | 셀렉터 | 예시 텍스트 |
|------|--------|------------|
| 브랜치 래퍼 | `div[data-testid="branch-navigation"]` | — |
| 이전 브랜치 버튼 | `button[aria-label="Previous edit"]` | `‹` |
| 다음 브랜치 버튼 | `button[aria-label="Next edit"]` | `›` |
| 현재/전체 표시 | `span.branch-indicator` | `"2 / 3"` 형태 |

> ⚠️ **주의:** `branch-navigation`은 **브랜치가 2개 이상**일 때만 렌더링됩니다.  
> 최초 메시지(브랜치 없음)에는 이 요소가 존재하지 않습니다.

### 2-4. AI 응답 (Assistant Turn)

| 역할 | 셀렉터 | 비고 |
|------|--------|------|
| AI 턴 래퍼 | `[data-testid="assistant-turn"]` | human-turn 직후 인접 형제 |
| 응답 본문 | `[data-testid="ai-response"]` | 마크다운 렌더링 컨테이너 |
| 응답 로딩 중 | `[data-testid="streaming-indicator"]` | 존재 여부로 스트리밍 감지 |

### 2-5. 입력창 (Composer)

| 역할 | 셀렉터 | 비고 |
|------|--------|------|
| 입력창 래퍼 | `[data-testid="composer"]` | fixed 하단 |
| 텍스트에어리어 | `[data-testid="message-input"]` | ProseMirror 기반 |
| 전송 버튼 | `button[aria-label="Send message"]` | |

---

## 3. 챗박스 ID 추출 전략

Claude.ai는 각 `human-turn`에 명시적 `id` 속성을 부여하지 않습니다.  
따라서 **인덱스 기반 가상 ID**를 Content Script에서 직접 생성합니다.

```typescript
// content-script/chatbox-tracker.ts

function assignChatboxIds(): ChatboxNode[] {
  const turns = document.querySelectorAll('[data-testid="human-turn"]');
  const nodes: ChatboxNode[] = [];

  turns.forEach((el, index) => {
    // 기존 마킹이 없을 때만 data-attribute 주입
    if (!el.getAttribute('data-nav-id')) {
      el.setAttribute('data-nav-id', `chatbox-${index}`);
    }

    const branchNav = el.querySelector('[data-testid="branch-navigation"]');
    const branchIndicator = branchNav?.querySelector('span.branch-indicator');
    const [current, total] = branchIndicator?.textContent?.split('/').map(Number) ?? [1, 1];

    nodes.push({
      id: el.getAttribute('data-nav-id')!,
      index,
      text: el.querySelector('[data-testid="user-message"] p')?.textContent ?? '',
      hasBranch: !!branchNav,
      branchCurrent: current,
      branchTotal: total,
      element: el as HTMLElement,
    });
  });

  return nodes;
}
```

---

## 4. MutationObserver 설정

새 챗박스 추가 및 브랜치 변경을 실시간으로 감지합니다.

```typescript
// content-script/observer.ts

const container = document.querySelector('[data-testid="conversation-container"]');

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      // 새 human-turn 또는 assistant-turn 추가
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.matches('[data-testid="human-turn"]') ||
              node.querySelector('[data-testid="human-turn"]')) {
            chrome.runtime.sendMessage({ type: 'CHATBOX_ADDED' });
          }
        }
      });
    }

    if (mutation.type === 'attributes' && mutation.attributeName === 'data-testid') {
      // branch-navigation 동적 삽입 감지
      const target = mutation.target as HTMLElement;
      if (target.dataset.testid === 'branch-navigation') {
        chrome.runtime.sendMessage({ type: 'BRANCH_CHANGED' });
      }
    }
  }
});

if (container) {
  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-testid'],
  });
}
```

---

## 5. 스크롤 이동 구현

Tree에서 노드 클릭 시 해당 챗박스로 스크롤합니다.

```typescript
// content-script/scroll-navigator.ts

export function scrollToChatbox(navId: string): void {
  const target = document.querySelector(`[data-nav-id="${navId}"]`);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // 시각적 하이라이트 (1.5초)
  target.classList.add('nav-highlight');
  setTimeout(() => target.classList.remove('nav-highlight'), 1500);
}
```

CSS (content_styles.css):
```css
[data-nav-id].nav-highlight {
  outline: 2px solid #7c3aed;
  outline-offset: 4px;
  border-radius: 8px;
  transition: outline 0.2s ease;
}
```

---

## 6. URL 패턴 및 페이지 전환 감지

Claude.ai는 SPA(Next.js)이므로 URL 변경을 `popstate` + `pushstate` 패치로 감지합니다.

```typescript
// content-script/page-watcher.ts

// 대화 URL 패턴: /chat/<uuid>
const CHAT_URL_PATTERN = /^\/chat\/[a-f0-9-]{36}$/;

function isChatPage(): boolean {
  return CHAT_URL_PATTERN.test(location.pathname);
}

// History API 패치 (SPA 라우팅 감지)
const _pushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _pushState(...args);
  window.dispatchEvent(new Event('locationchange'));
};

window.addEventListener('locationchange', () => {
  if (isChatPage()) {
    // 새 대화 진입 → 트리 초기화
    chrome.runtime.sendMessage({ type: 'CHAT_PAGE_ENTERED', url: location.href });
  }
});
```

---

## 7. 알려진 제약사항 및 주의사항

| 항목 | 내용 |
|------|------|
| **CSS 클래스 불안정성** | Tailwind 기반의 해시된 클래스명은 변경될 수 있음 → `data-testid` 우선 사용 |
| **브랜치 직접 접근 불가** | 다른 브랜치의 DOM은 현재 활성 브랜치 외에는 렌더링되지 않음 |
| **스트리밍 중 DOM 변동** | AI 응답 스트리밍 중 MutationObserver 이벤트 과다 발생 → 디바운싱 필요 |
| **Shadow DOM 없음** | Claude.ai는 Shadow DOM 미사용, 표준 셀렉터로 접근 가능 |
| **로그인 상태 확인** | `[data-testid="conversation-container"]` 미존재 시 로그인 페이지로 간주 |

---

## 8. 정기 검증 체크리스트

DOM 구조는 Claude.ai 배포에 따라 변경될 수 있습니다.  
**월 1회** 또는 **기능 오작동 리포트 접수 시** 아래를 점검합니다.

- [ ] `[data-testid="conversation-container"]` 존재 여부
- [ ] `[data-testid="human-turn"]` 챗박스 감지 정상 여부
- [ ] `[data-testid="branch-navigation"]` 브랜치 감지 정상 여부
- [ ] `span.branch-indicator` 텍스트 파싱 형식 (`"N / M"`)
- [ ] `scrollIntoView` 정상 동작 여부
