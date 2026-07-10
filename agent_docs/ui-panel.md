# UI Panel

> **Purpose:** Component structure, layout, and interaction specification for the Tree Map navigation panel floating over the chat session  
> **Depends on:** [`architecture.md`](./architecture.md) §2-3, [`branch-detection.md`](./branch-detection.md) §6

---

## 1. Panel Overview

```
┌──────────────────────────────────────┐
│ ≡  ChatTree                [⚙] [✕]  │  ← Header (drag handle)
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
| Keep cache | Dropdown | 7 / 30 / 90 days (default 30) — tree-cache retention, issue #153 |
| Clear cached trees | Button | Two-step confirm (re-click within 3 s); clears `tree_*` only, bookmarks/tags untouched |

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

## 8. Design Tokens (`--nav-*`)

> **Single source of truth:** the `:host` (light) and `:host([data-theme='dark'])`
> (dark) blocks in `panel.css`. Edit values there only. Groups below mirror the
> comment sections in that file 1:1.
>
> Dark theme overrides colors and sets `color-scheme: dark`; structural groups
> (Shape, Typography, Animation, z-index) are theme-independent.

### Root
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `color-scheme` | `light` | `dark` | Native control rendering (`<select>` options, scrollbars) — #127 |
| `--nav-z-index` | `2147483647` | — | Top layer (max) |

### Shape
| Token | Value | Purpose |
|---|---|---|
| `--nav-border-width` | `1px` | Default hairline border width |
| `--nav-border-radius` | `16px` | Panel corners |
| `--nav-border-radius-sm` | `9px` | Controls / inputs |
| `--nav-radius-md` | `8px` | Tooltip, scrollbar thumb, header icon |
| `--nav-radius-pill` | `999px` | Pill badges / buttons / chips / range track |

### Surfaces
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-bg` | `#ffffff` | `#1e1b18` | Panel background (opaque) |
| `--nav-color-bg-rgb` | `255 255 255` | `30 27 24` | Composed with `--bg-alpha` in PanelShell |
| `--nav-color-surface-2` | `#f7f5f1` | `rgba(255,255,255,.06)` | Hover / fill surface |

### Shadow & Borders
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-panel-shadow` | warm soft shadow | deeper dark shadow | Panel drop shadow |
| `--nav-color-border` | `#e9e5df` | `rgba(255,255,255,.1)` | Panel/control hairline |
| `--nav-color-divider` | `#efece7` | `rgba(255,255,255,.08)` | Section divider |

### Typography
| Token | Value | Purpose |
|---|---|---|
| `--nav-font-family` | `'Inter', -apple-system, …` | UI font |
| `--nav-font-size-xs` | `10px` | Badges, tooltip labels, small chips |
| `--nav-font-size-sm` | `11px` | Small text |
| `--nav-font-size-md` | `12px` | Node label, tooltip body |
| `--nav-font-size-base` | `13px` | Base text |

### Spacing
| Token | Value | Purpose |
|---|---|---|
| `--nav-spacing-1` | `2px` | Spacing scale — padding / gap / margin |
| `--nav-spacing-2` | `4px` | |
| `--nav-spacing-3` | `6px` | |
| `--nav-spacing-4` | `8px` | |
| `--nav-spacing-5` | `10px` | |
| `--nav-spacing-6` | `12px` | |
| `--nav-spacing-7` | `14px` | |

> Off-scale one-off spacings (e.g. 11/24/28/40px) are kept as literals — no token exists for them, per the "no hardcoded px **where a token exists**" criterion.

### Text
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-text` | `#2a2723` | `#f5f2ec` | Default text (on panel bg) |
| `--nav-color-text-secondary` | `#57534e` | `rgba(245,242,236,.7)` | Secondary text |
| `--nav-color-text-muted` | `#8d8881` | `#a8a299` | Muted / label text |

### Accent (Claude clay)
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-accent` | `#d97757` | `#e08a6e` | Clay accent |
| `--nav-color-accent-hover` | `#c8643f` | `#ec9a7e` | Accent hover |
| `--nav-color-accent-soft` | `rgba(217,119,87,.12)` | `rgba(224,138,110,.16)` | Soft accent fill |

### Nodes
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-node-fill` | `#ffffff` | `rgba(255,255,255,.05)` | Previous node fill |
| `--nav-color-node-border` | `#d9d4cb` | `rgba(255,255,255,.2)` | Previous node ring |
| `--nav-color-node-number` | `#8d8881` | `#b8b2a9` | Previous node number |
| `--nav-color-node-active` | `#d97757` | `#d97757` | Active node fill |
| `--nav-color-node-active-text` | `#ffffff` | `#ffffff` | Text on accent-filled node/badge |
| `--nav-color-node-branch` | `#d97757` | `#e08a6e` | Branch badge fill |
| `--nav-color-edge` | `#e4e0d9` | `rgba(255,255,255,.16)` | Connector line |
| `--nav-active-glow` | clay drop-shadow | brighter clay glow | Active node glow |

### Animation
| Token | Value | Purpose |
|---|---|---|
| `--nav-duration-fast` | `150ms` | Fast transitions |
| `--nav-duration-base` | `200ms` | Default transitions |
| `--nav-duration-slow` | `300ms` | Slow transitions |
| `--nav-transition` | `var(--nav-duration-base) ease` | Default transition shorthand |

> **Reduced motion:** under `@media (prefers-reduced-motion: reduce)` the duration
> tokens become `0ms` and `--nav-active-glow` is disabled.

---

## References

- [`architecture.md`](./architecture.md) — Shadow DOM mount strategy, tech stack
- [`branch-detection.md`](./branch-detection.md) — Branch node data structure
- [`dom-analysis.md`](./dom-analysis.md) — DOM selectors for active node tracking
