# UI Panel

> **Purpose:** Component structure, layout, and interaction specification for the Tree Map navigation panel floating over the chat session  
> **Depends on:** [`architecture.md`](./architecture.md) §2-3, [`branch-detection.md`](./branch-detection.md) §6

---

## 1. Panel Overview

```
┌──────────────────────────────────────┐
│ ≡  Chat Navigator          [⚙] [✕]  │  ← Header (drag handle)
├──────────────────────────────────────┤
│                                      │
│   [Q0]──[Q1]──[Q2]                  │  ← TreeMap
│             └──[Q2']                 │    (D3 hierarchy)
│                  └──[Q3]            │
│                                      │
├──────────────────────────────────────┤
│  ↕ Top-Down  │ ◐ 80%  │ ↓ Newest   │  ← ControlBar
└──────────────────────────────────────┘
```

- **Default position:** Top-right (draggable)
- **Default size:** 280px × 320px (min 200px × 160px, max 480px × 600px)
- Mounted inside Shadow DOM to isolate from host page CSS

---

## 2. Component Tree

```
<App>                          ← Zustand Provider, message listener
  <PanelShell>                 ← Shadow DOM mount wrapper, manages size and position
    <Header>                   ← Drag handle, title, settings/close buttons
    <TreeMapCanvas>            ← SVG-based tree rendering area
      <TreeNode>               ← Individual chatbox node (N)
        <NodeBadge>            ← Branch badge (conditional)
      <TreeEdge>               ← Connecting edges between nodes (N-1)
    <Tooltip>                  ← Mouse-over popup (Portal)
    <ControlBar>               ← Direction, opacity, and sort controls
    <EmptyState>               ← Placeholder when no chatboxes exist
```

---

## 3. Component Specifications

### 3-1. `<App>`

```typescript
// panel/App.tsx

import { useEffect } from 'react';
import { usePanelStore } from './store/panel-store';

export default function App() {
  const { setTree, settings } = usePanelStore();

  useEffect(() => {
    // Receive tree data from Background
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

| Prop | Type | Description |
|------|------|-------------|
| `position` | `PanelPosition` | Panel position (e.g. `top-right`) |
| `opacity` | `number` | Background opacity (0.0~1.0) |

**Positioning CSS Strategy:**

```typescript
const positionStyle: Record<PanelPosition, React.CSSProperties> = {
  'top-right':    { top: '80px',    right: '20px'   },
  'top-left':     { top: '80px',    left: '20px'    },
  'bottom-right': { bottom: '80px', right: '20px'   },
  'bottom-left':  { bottom: '80px', left: '20px'    },
};
```

**Drag Implementation:**

```typescript
// Uses useDraggable custom hook
// mousedown → mousemove → mouseup
// position is fixed + transform: translate(dx, dy)
```

### 3-3. `<TreeMapCanvas>`

Renders an SVG tree using the D3 `hierarchy` + `tree` layout.

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

**Coordinate Mapping (Top-Down vs Left-Right):**

| Direction | X-axis meaning | Y-axis meaning |
|-----------|----------------|----------------|
| `top-down` | Horizontal spread | Depth (top→bottom) |
| `left-right` | Depth (left→right) | Vertical spread |

### 3-4. `<TreeNode>`

```typescript
interface TreeNodeProps {
  node: ChatboxNode;
  isActive: boolean;     // Node near current scroll position
  onClick: () => void;
}
```

**Visual Spec:**

| State | Size | Background | Border |
|-------|------|-----------|--------|
| Default | 36×36px | `--nav-color-node` (`#7c3aed`) | None |
| Active (current position) | 40×40px | `--nav-color-active` (`#6d28d9`) | 2px white |
| Branch node | 36×36px | `--nav-color-branch` (`#d97706`) | None |
| Hover | 38×38px | 10% lighter | 1px `--nav-color-hover` |

**Node Label:**
- Summary text: max 8 chars + `...` (truncated)
- If summary not yet generated: `Loading...` spinner
- On mouse-over: full original prompt shown via `<Tooltip>`

### 3-5. `<NodeBadge>`

Rendered only on branch point nodes.

```typescript
// e.g., "🔀 3" → 3 branches, currently 2nd active
<NodeBadge branchTotal={3} branchCurrent={2} />
```

```
┌──────────────────┐
│   [Q2]           │
│  🔀 3 · 2nd      │  ← NodeBadge
└──────────────────┘
```

### 3-6. `<Tooltip>`

```typescript
interface TooltipProps {
  text: string;        // Original prompt
  anchorEl: HTMLElement;
}
```

- Rendered via Portal at the top of the Shadow DOM
- Max width: 320px, max height: 200px (overflow: scroll)
- Delay: shown after 300ms hover, hidden immediately on leave

### 3-7. `<ControlBar>`

```
[ ↕ Top-Down ▾ ]  [ ◐ 80% ]  [ ↓ Newest ▾ ]
```

| Control | Type | Options |
|---------|------|---------|
| Direction | Dropdown | Top-Down / Left-Right |
| Position | Dropdown | Top-Right / Bottom-Right / Top-Left / Bottom-Left |
| Opacity | Slider | 0% ~ 100% (default 80%) |
| Sort | Toggle | Newest (↓) / Oldest (↑) |

---

## 4. Zustand Store

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
      partialize: (s) => ({ settings: s.settings }), // persist settings only
    }
  )
);
```

---

## 5. Automatic Active Node Tracking

Automatically highlights the tree node corresponding to the chatbox currently in view based on scroll position.

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

// Observe all human-turn elements
document.querySelectorAll('[data-nav-id]').forEach(el => IO.observe(el));
```

---

## 6. Responsiveness and Accessibility

### Panel Resizing
- Resize via drag handle at the bottom-right corner
- Internal D3 layout is automatically recalculated via `ResizeObserver`

### Keyboard Accessibility
| Key | Action |
|-----|--------|
| `Tab` | Move focus between nodes |
| `Enter` / `Space` | Scroll to the chatbox |
| `Esc` | Close panel |

### Color Contrast
- All text: WCAG AA standard (4.5:1 or higher)
- Dark mode support: branched via CSS `@media (prefers-color-scheme: dark)`

---

## 7. Animation Spec

| Event | Animation | Duration |
|-------|-----------|----------|
| Panel first shown | fade-in + slide-in (from right) | 200ms ease-out |
| New node added | node pop-in (scale 0→1) | 150ms ease-out |
| Scroll after node click | pulse on node in tree | 600ms |
| On branch switch | replaced nodes fade-out→in | 250ms |
| Direction change | layout morph (D3 transition) | 300ms ease-in-out |

When reduced motion is set, all animations are disabled:
```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
```

---

## 8. CSS Custom Properties (Design Tokens)

CSS variables used inside the Shadow DOM.

```css
:host {
  /* Colors */
  --nav-color-bg: rgba(17, 17, 27, 0.85);
  --nav-color-node: #7c3aed;
  --nav-color-node-active: #6d28d9;
  --nav-color-node-branch: #d97706;
  --nav-color-node-hover: #8b5cf6;
  --nav-color-edge: rgba(139, 92, 246, 0.4);
  --nav-color-text: #f1f5f9;
  --nav-color-text-muted: #94a3b8;
  --nav-color-border: rgba(255, 255, 255, 0.12);

  /* Typography */
  --nav-font-family: 'Inter', -apple-system, sans-serif;
  --nav-font-size-sm: 11px;
  --nav-font-size-base: 13px;

  /* Layout */
  --nav-border-radius: 12px;
  --nav-panel-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --nav-z-index: 2147483647; /* maximum z-index */
}
```

---

## References

- [`architecture.md`](./architecture.md) — Shadow DOM mount strategy, tech stack
- [`branch-detection.md`](./branch-detection.md) — Branch node data structure
- [`dom-analysis.md`](./dom-analysis.md) — DOM selectors for active node tracking
