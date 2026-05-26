# Branch Detection

> **목적:** Claude.ai에서 챗박스 브랜치(편집·재전송으로 생성되는 분기)를 감지하고 트리 구조로 모델링하는 로직  
> **의존 문서:** [`dom-analysis.md`](./dom-analysis.md) §3, §4

---

## 1. 브랜치란?

Claude.ai에서 유저가 이미 전송한 메시지를 **편집(Edit)** 하고 재전송하면:
1. 기존 메시지가 숨겨지고 새 메시지가 표시됩니다.
2. 동일 위치에 `"1 / 2"`, `"2 / 3"` 형태의 **브랜치 네비게이터**가 삽입됩니다.
3. 선택된 브랜치에 따라 그 이후의 AI 응답·유저 메시지 전체가 교체됩니다.

```
chatbox-0: "파이썬 입문 방법을 알려줘"
   │
   ├── Branch 1: "파이썬 입문 방법을 알려줘" (원본)
   │       └── chatbox-1-b1: "책 추천해줘"
   │               └── chatbox-2-b1: "온라인 강의는?"
   │
   └── Branch 2: "파이썬 실무 활용법을 알려줘" (수정본)  ← 현재 활성
           └── chatbox-1-b2: "프로젝트 예시 알려줘"
```

---

## 2. 핵심 제약사항

| 제약 | 내용 |
|------|------|
| **비활성 브랜치 DOM 미존재** | 현재 선택되지 않은 브랜치는 DOM에 렌더링되지 않음 |
| **히스토리 API 접근 불가** | 이전 브랜치의 메시지를 직접 읽을 수 없음 |
| **브랜치 전환은 네이티브 기능** | `‹` / `›` 버튼은 Claude.ai 자체 기능 — 오버라이드 불가 |

> 따라서 **브랜치 전체 트리의 완전한 재구성은 불가능**합니다.  
> 본 프로젝트는 **활성 브랜치 경로 추적** + **브랜치 발생 지점 시각화** 전략을 채택합니다.

---

## 3. 브랜치 감지 알고리즘

### Step 1: 브랜치 노드 식별

```typescript
// content/branch-detector.ts

interface BranchInfo {
  hasBranch: boolean;
  current: number;
  total: number;
}

export function detectBranch(humanTurnEl: HTMLElement): BranchInfo {
  const nav = humanTurnEl.querySelector('[data-testid="branch-navigation"]');

  if (!nav) {
    return { hasBranch: false, current: 1, total: 1 };
  }

  const indicator = nav.querySelector('span.branch-indicator');
  const text = indicator?.textContent?.trim() ?? '1 / 1';

  // "2 / 3" → current: 2, total: 3
  const [current, total] = text.split('/').map(s => parseInt(s.trim(), 10));

  return {
    hasBranch: total > 1,
    current: isNaN(current) ? 1 : current,
    total: isNaN(total) ? 1 : total,
  };
}
```

### Step 2: 트리 구조 구축

```typescript
// content/tree-builder.ts

export function buildTree(nodes: ChatboxNode[]): TreeData {
  const result: ChatboxNode[] = [];
  let lastBranchNodeId: string | null = null;

  for (const node of nodes) {
    if (node.hasBranch) {
      // 브랜치 발생 지점 — parentId를 이전 브랜치 노드로 지정
      node.parentId = lastBranchNodeId;
      lastBranchNodeId = node.id;
    } else {
      // 일반 노드 — 직전 노드를 부모로
      node.parentId = result.length > 0 ? result[result.length - 1].id : null;
    }
    result.push(node);
  }

  return {
    sessionId: extractSessionId(location.href),
    nodes: result,
    activeBranchPath: result.map(n => n.id),
    lastUpdated: Date.now(),
  };
}

function extractSessionId(url: string): string {
  // "https://claude.ai/chat/<uuid>" → "<uuid>"
  const match = url.match(/\/chat\/([a-f0-9-]{36})/);
  return match?.[1] ?? 'unknown';
}
```

---

## 4. 브랜치 전환 감지

유저가 `‹` / `›` 버튼을 눌러 브랜치를 전환하면 DOM이 교체됩니다.  
이를 MutationObserver로 감지하여 트리를 **부분 재로드**합니다.

```typescript
// content/branch-change-watcher.ts

export function watchBranchChanges(
  container: HTMLElement,
  onBranchChange: (fromNodeId: string) => void
): () => void {

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // branch-indicator 텍스트 변경 감지
      if (
        mutation.type === 'characterData' &&
        (mutation.target as Text).parentElement?.matches('span.branch-indicator')
      ) {
        const humanTurn = (mutation.target as Text)
          .closest('[data-testid="human-turn"]') as HTMLElement | null;

        const navId = humanTurn?.getAttribute('data-nav-id') ?? '';
        if (navId) {
          // 디바운싱: 연속 전환 시 마지막 한 번만 처리
          debouncedBranchChange(navId, onBranchChange);
        }
      }
    }
  });

  observer.observe(container, {
    subtree: true,
    characterData: true,
  });

  return () => observer.disconnect();
}

// 150ms 디바운스
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedBranchChange(navId: string, cb: (id: string) => void) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => cb(navId), 150);
}
```

---

## 5. 브랜치 재로드 전략

브랜치 전환 후 DOM이 교체되면 **전환 지점 이후의 노드들만** 재스캔합니다.

```typescript
// content/chatbox-tracker.ts (partial reload)

export function reloadFromNode(
  branchNodeId: string,
  allNodes: ChatboxNode[]
): ChatboxNode[] {
  const branchIndex = allNodes.findIndex(n => n.id === branchNodeId);
  if (branchIndex === -1) return allNodes;

  // 브랜치 노드까지는 유지, 이후만 재스캔
  const preserved = allNodes.slice(0, branchIndex + 1);

  // branchIndex+1 이후 DOM 재스캔
  const turns = document.querySelectorAll('[data-testid="human-turn"]');
  const newNodes: ChatboxNode[] = [];

  turns.forEach((el, index) => {
    if (index <= branchIndex) return; // 이미 보존된 노드

    const navId = `chatbox-${index}`;
    el.setAttribute('data-nav-id', navId);

    const { hasBranch, current, total } = detectBranch(el as HTMLElement);

    newNodes.push({
      id: navId,
      index,
      text: el.querySelector('[data-testid="user-message"] p')?.textContent ?? '',
      summary: '',           // 요약 재생성 필요
      hasBranch,
      branchCurrent: current,
      branchTotal: total,
      parentId: preserved[preserved.length - 1]?.id ?? null,
    });
  });

  return [...preserved, ...newNodes];
}
```

---

## 6. UI에서의 브랜치 표현 규칙

| 상태 | 노드 색상 | 배지 |
|------|----------|------|
| 일반 노드 | `--color-node-default` (보라 계열) | 없음 |
| 브랜치 발생 지점 | `--color-node-branch` (주황) | `🔀 N개 브랜치` |
| 비활성 브랜치 (추정) | `--color-node-inactive` (회색) | `(이전 브랜치)` |
| 현재 선택 노드 | `--color-node-active` (강조 보라) | 테두리 하이라이트 |

> 비활성 브랜치 노드는 DOM에 존재하지 않으므로 **브랜치 발생 지점 노드에 통합 표시**합니다.  
> 예: 분기점 노드 배지 → `🔀 3개 브랜치 · 현재: 2번째`

---

## 7. 엣지 케이스

### 7-1. 중첩 브랜치 (브랜치의 브랜치)

```
chatbox-0
  ├── Branch 1
  │     ├── chatbox-1
  │     │     ├── Branch 1-1  ← 중첩 브랜치
  │     │     └── Branch 1-2
  │     └── chatbox-2
  └── Branch 2
```

- DOM에는 현재 활성 경로만 존재합니다.
- `branchTotal`이 1보다 큰 노드는 모두 분기점으로 표시합니다.
- 깊이 제한 없이 재귀적으로 처리합니다.

### 7-2. 첫 번째 메시지 편집

- `chatbox-0`이 브랜치를 가지면 트리 최상단 노드가 분기점이 됩니다.
- `parentId: null`로 처리하며, 트리 루트에 분기 배지를 표시합니다.

### 7-3. 스트리밍 중 브랜치 전환 시도

```typescript
// 스트리밍 중 브랜치 변경 이벤트는 무시
function isStreaming(): boolean {
  return !!document.querySelector('[data-testid="streaming-indicator"]');
}

// observer에서 early return
if (isStreaming()) return;
```

---

## 8. 테스트 시나리오

| 시나리오 | 기대 결과 |
|----------|----------|
| 단일 메시지 편집 1회 | `branchTotal: 2`, 분기점 노드 생성 |
| 동일 메시지 3회 편집 | `branchTotal: 3`, 배지 `🔀 3개 브랜치` |
| 브랜치 전환 후 새 메시지 | 전환 지점 이후 노드 재스캔, 트리 업데이트 |
| 10개 이상 메시지 후 편집 | 성능 저하 없이 부분 재로드 |
| 페이지 새로고침 | 트리 초기화 후 전체 재스캔 |

---

## 참조

- [`dom-analysis.md`](./dom-analysis.md) — DOM 셀렉터 원본 정의
- [`architecture.md`](./architecture.md) — 전체 아키텍처에서 브랜치 데이터 플로우
- [`ui-panel.md`](./ui-panel.md) — 브랜치 노드 렌더링 규칙
