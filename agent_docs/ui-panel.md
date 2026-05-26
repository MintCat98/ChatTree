# UI Panel

> **목적:** 채팅 세션 위에 플로팅되는 Tree Map 네비게이션 패널의 컴포넌트 구조, 레이아웃, 인터랙션 명세  
> **의존 문서:** [`architecture.md`](./architecture.md) §2-3, [`branch-detection.md`](./branch-detection.md) §6

---

## 1. 패널 개요

```
┌──────────────────────────────────────┐
│ ≡  Chat Navigator          [⚙] [✕]  │  ← Header (드래그 핸들)
├──────────────────────────────────────┤
│                                      │
│   [Q0]──[Q1]──[Q2]                  │  ← TreeMap
│             └──[Q2']                 │    (D3 hierarchy)
│                  └──[Q3]            │
│                                      │
├──────────────────────────────────────┤
│  ↕ Top-Down  │ ◐ 80%  │ ↓ 최신순   │  ← ControlBar
└──────────────────────────────────────┘
```

- **기본 위치:** 오른쪽 상단 (드래그로 이동 가능)
- **기본 크기:** 280px × 320px (최소 200px × 160px, 최대 480px × 600px)
- **Shadow DOM** 내부에 마운트되어 호스트 페이지 CSS 격리

---

## 2. 컴포넌트 트리

```
<App>                          ← Zustand Provider, 메시지 리스너
  <PanelShell>                 ← Shadow DOM 마운트 래퍼, 크기·위치 관리
    <Header>                   ← 드래그 핸들, 제목, 설정/닫기 버튼
    <TreeMapCanvas>            ← SVG 기반 트리 렌더링 영역
      <TreeNode>               ← 개별 챗박스 노드 (N개)
        <NodeBadge>            ← 브랜치 배지 (조건부)
      <TreeEdge>               ← 노드 간 연결선 (N-1개)
    <Tooltip>                  ← 마우스오버 팝업 (Portal)
    <ControlBar>               ← 방향·투명도·정렬 컨트롤
    <EmptyState>               ← 챗박스 없을 때 플레이스홀더
```

---

## 3. 컴포넌트별 명세

### 3-1. `<App>`

```typescript
// panel/App.tsx

import { useEffect } from 'react';
import { usePanelStore } from './store/panel-store';

export default function App() {
  const { setTree, settings } = usePanelStore();

  useEffect(() => {
    // Background에서 트리 데이터 수신
    const handler = (msg: ExtensionMessage) => {
      if (msg.type === 'TREE_READY') setTree(msg.tree);
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  if (!settings.panelVisible) return null;

  return (
    <PanelShell>
      <Header />
      <TreeMapCanvas />
      <ControlBar />
    </PanelShell>
  );
}
```

### 3-2. `<PanelShell>`

| Prop | 타입 | 설명 |
|------|------|------|
| `position` | `PanelPosition` | 패널 위치 (`top-right` 등) |
| `opacity` | `number` | 배경 투명도 (0.0~1.0) |

**포지셔닝 CSS 전략:**

```typescript
const positionStyle: Record<PanelPosition, React.CSSProperties> = {
  'top-right':    { top: '80px',    right: '20px'   },
  'top-left':     { top: '80px',    left: '20px'    },
  'bottom-right': { bottom: '80px', right: '20px'   },
  'bottom-left':  { bottom: '80px', left: '20px'    },
};
```

**드래그 구현:**

```typescript
// useDraggable 커스텀 훅 사용
// mousedown → mousemove → mouseup
// position은 fixed + transform: translate(dx, dy)
```

### 3-3. `<TreeMapCanvas>`

D3 `hierarchy` + `tree` 레이아웃을 사용하여 SVG 트리를 렌더링합니다.

```typescript
// panel/TreeMapCanvas.tsx
import * as d3 from 'd3';

type Direction = 'top-down' | 'left-right';

function buildD3Layout(nodes: ChatboxNode[], direction: Direction) {
  const root = d3.hierarchy(buildTreeRoot(nodes));

  const treeLayout = direction === 'top-down'
    ? d3.tree<ChatboxNode>().size([canvasWidth - 40, canvasHeight - 40])
    : d3.tree<ChatboxNode>().size([canvasHeight - 40, canvasWidth - 40]);

  return treeLayout(root);
}
```

**좌표 매핑 (Top-Down vs Left-Right):**

| Direction | x축 의미 | y축 의미 |
|-----------|----------|----------|
| `top-down` | 수평 분산 | 깊이 (상→하) |
| `left-right` | 깊이 (좌→우) | 수직 분산 |

### 3-4. `<TreeNode>`

```typescript
interface TreeNodeProps {
  node: ChatboxNode;
  isActive: boolean;     // 현재 스크롤 위치 근처 노드
  onClick: () => void;
}
```

**비주얼 스펙:**

| 상태 | 크기 | 배경색 | 테두리 |
|------|------|--------|--------|
| 기본 | 36×36px | `--nav-color-node` (`#7c3aed`) | 없음 |
| 활성 (현재 위치) | 40×40px | `--nav-color-active` (`#6d28d9`) | 2px white |
| 브랜치 노드 | 36×36px | `--nav-color-branch` (`#d97706`) | 없음 |
| 호버 | 38×38px | 10% 밝게 | 1px `--nav-color-hover` |

**노드 라벨:**
- 요약 텍스트: 최대 8자 + `...` (말줄임)
- 요약 미생성 시: `로딩...` 스피너
- 마우스오버 시: `<Tooltip>`으로 원본 프롬프트 전체 표시

### 3-5. `<NodeBadge>`

브랜치 발생 지점 노드에만 렌더링됩니다.

```typescript
// 예: "🔀 3" → 브랜치 3개, 현재 2번째 활성
<NodeBadge branchTotal={3} branchCurrent={2} />
```

```
┌──────────────────┐
│   [Q2]           │
│  🔀 3 · 2번째    │  ← NodeBadge
└──────────────────┘
```

### 3-6. `<Tooltip>`

```typescript
interface TooltipProps {
  text: string;        // 원본 프롬프트
  anchorEl: HTMLElement;
}
```

- Portal로 Shadow DOM 바깥 최상단에 렌더링
- 최대 너비: 320px, 최대 높이: 200px (overflow: scroll)
- 딜레이: hover 300ms 후 표시, leave 즉시 숨김

### 3-7. `<ControlBar>`

```
[ ↕ Top-Down ▾ ]  [ ◐ 80% ]  [ ↓ 최신순 ▾ ]
```

| 컨트롤 | 타입 | 옵션 |
|--------|------|------|
| 방향 | Dropdown | Top-Down / Left-Right |
| 위치 | Dropdown | 우상단 / 우하단 / 좌상단 / 좌하단 |
| 투명도 | Slider | 0% ~ 100% (기본 80%) |
| 정렬 | Toggle | 최신순 (↓) / 오래된순 (↑) |

---

## 4. Zustand 스토어

```typescript
// panel/store/panel-store.ts

interface PanelState {
  tree: TreeData | null;
  settings: UserSettings;
  hoveredNodeId: string | null;
  activeNodeId: string | null;

  // Actions
  setTree: (tree: TreeData) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  setHoveredNode: (id: string | null) => void;
  setActiveNode: (id: string | null) => void;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      tree: null,
      settings: DEFAULT_SETTINGS,
      hoveredNodeId: null,
      activeNodeId: null,

      setTree: (tree) => set({ tree }),
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      setHoveredNode: (id) => set({ hoveredNodeId: id }),
      setActiveNode: (id) => set({ activeNodeId: id }),
    }),
    {
      name: 'chat-nav-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings }), // 설정만 영속화
    }
  )
);
```

---

## 5. 활성 노드 자동 추적

스크롤 위치 기반으로 현재 보고 있는 챗박스에 해당하는 트리 노드를 자동으로 하이라이트합니다.

```typescript
// content/active-node-tracker.ts

const IO = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (visible.length > 0) {
      const navId = (visible[0].target as HTMLElement).getAttribute('data-nav-id');
      if (navId) {
        chrome.runtime.sendMessage({ type: 'ACTIVE_NODE_CHANGED', navId });
      }
    }
  },
  { threshold: 0.5 }
);

// 모든 human-turn 요소 관찰
document.querySelectorAll('[data-nav-id]').forEach(el => IO.observe(el));
```

---

## 6. 반응형 및 접근성

### 패널 크기 조절
- 우하단 모서리 drag 핸들로 리사이즈
- `ResizeObserver`로 내부 D3 레이아웃 자동 재계산

### 키보드 접근성
| 키 | 동작 |
|----|------|
| `Tab` | 노드 간 포커스 이동 |
| `Enter` / `Space` | 해당 챗박스로 스크롤 이동 |
| `Esc` | 패널 닫기 |

### 색상 대비
- 모든 텍스트: WCAG AA 기준 (4.5:1 이상)
- 다크모드 지원: CSS `@media (prefers-color-scheme: dark)` 분기

---

## 7. 애니메이션 스펙

| 이벤트 | 애니메이션 | 시간 |
|--------|-----------|------|
| 패널 최초 표시 | fade-in + slide-in (오른쪽에서) | 200ms ease-out |
| 새 노드 추가 | 노드 pop-in (scale 0→1) | 150ms ease-out |
| 노드 클릭 후 스크롤 | 트리에서 해당 노드 pulse | 600ms |
| 브랜치 변경 시 | 교체되는 노드 fade-out→in | 250ms |
| 방향 전환 | 레이아웃 morph (D3 transition) | 300ms ease-in-out |

모션 감소 설정 시 모든 애니메이션 즉시 처리:
```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
```

---

## 8. CSS 커스텀 프로퍼티 (Design Tokens)

Shadow DOM 내부에서 사용하는 CSS 변수입니다.

```css
:host {
  /* 색상 */
  --nav-color-bg: rgba(17, 17, 27, 0.85);
  --nav-color-node: #7c3aed;
  --nav-color-node-active: #6d28d9;
  --nav-color-node-branch: #d97706;
  --nav-color-node-hover: #8b5cf6;
  --nav-color-edge: rgba(139, 92, 246, 0.4);
  --nav-color-text: #f1f5f9;
  --nav-color-text-muted: #94a3b8;
  --nav-color-border: rgba(255, 255, 255, 0.12);

  /* 타이포그래피 */
  --nav-font-family: 'Inter', -apple-system, sans-serif;
  --nav-font-size-sm: 11px;
  --nav-font-size-base: 13px;

  /* 레이아웃 */
  --nav-border-radius: 12px;
  --nav-panel-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --nav-z-index: 2147483647; /* 최상단 */
}
```

---

## 참조

- [`architecture.md`](./architecture.md) — Shadow DOM 마운트 전략, 기술 스택
- [`branch-detection.md`](./branch-detection.md) — 브랜치 노드 데이터 구조
- [`dom-analysis.md`](./dom-analysis.md) — 활성 노드 추적용 DOM 셀렉터
