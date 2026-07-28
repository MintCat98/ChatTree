---
name: building-panel-ui
description: Tree map panel UI - component specs, SVG layout constants, Zustand store, active-node tracking, accessibility, animation, and --nav-* design tokens. Use when working on src/content/panel/ React components, panel.css, or changing panel layout, theming, controls, or interactions.
---

# UI Panel

> **Purpose:** Component structure, layout, and interaction specification for the Tree Map navigation panel floating over the chat session
> **Depends on:** [messaging-and-storage](../messaging-and-storage/SKILL.md), [detecting-branches](../detecting-branches/SKILL.md) §6

---

## 1. Panel Overview

```
┌──────────────────────────────────────┐
│ ≡  ChatTree                [⚙] [✕]  │  ← Header (drag handle)
├──────────────────────────────────────┤
│                                      │
│   [Q0]──[Q1]──[Q2]                  │  ← TreeMap
│             └──[Q2']                 │    (hand-rolled SVG)
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
    <Header>                   ← Drag handle, title, filter/tag/search/settings buttons
    <TreeMapCanvas>            ← SVG-based tree rendering area
      <NodeConnector>          ← Vertical line between adjacent rows (N-1)
      <TreeNode>               ← Individual chatbox node (N)
        <NodeBadge>            ← Branch badge (conditional)
        <BookmarkButton>       ← Hover affordance, left gutter top
        <TagButton>            ← Hover affordance, left gutter bottom
        <HideButton>           ← Hover affordance, node top-right (#167)
      <GhostNode>              ← "earlier messages" dashed row (conditional, #152)
      <CollapsedRunButton>     ← "+ n" pill in a row gap (conditional, #167)
      <TagEditorPopover>       ← HTML overlay, anchored to a row (conditional)
    <Tooltip>                  ← Mouse-over popup (Portal, outside the Shadow DOM)
    <ControlBar>               ← Settings panel (conditional)
    <TagPanel> / <SearchPanel> ← Collapsible panels below the canvas (conditional)
    <EmptyState>               ← Placeholder when no chatboxes exist
```

`TreeEdge.tsx` and `BranchLane.tsx` exist in the folder but are **dead code** —
nothing imports them. Do not extend them.

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

Renders the tree as hand-rolled SVG — **no D3** (the `d3` dependency was
removed in #170; it was never imported). Nodes sit on a fixed vertical left
rail with the question label to the right of each circle; branch nodes shift
horizontally by `LANE_OFFSET`.

All coordinates come from `panel/components/constants.ts`:

```typescript
// panel/components/constants.ts (excerpt)
export const NODE_STEP = 58;   // Vertical distance between adjacent nodes
export const COLUMN_X  = 44;   // x of the node circle centers (left rail)

// viewBox height = top/bottom padding + N nodes × step
export function calcSvgHeight(nodeCount: number): number;
// node index (0-based) → vertical center coordinate
export function nodeCenterY(index: number): number;
```

Changing these constants automatically propagates to `TreeNode`,
`NodeConnector`, and `GhostNode`.

**Rows ≠ nodes.** Hidden nodes (#167) are dropped from the row flow entirely, so
never index rows with `tree.nodes`. The split lives in
`panel/components/tree-layout.ts` — a plain `.ts` module, because Jest's
`testMatch` only picks up `tests/unit/**/*.test.ts` and cannot test `.tsx`:

```typescript
buildTreeLayout(sortedNodes, sessionMetadata) → { visible, runs }
runCenterY(run, visibleCount, ghostOffset)    → y of the "+ n" pill
```

Row index for any rendered element is therefore
`visible.indexOf(node) + ghostOffset`, where `ghostOffset` is 1 when the ghost
row (#152) occupies row 0 in ascending order. This applies to the auto-scroll
effect and the `TagEditorPopover` anchor as well — both index `visible`.

### 3-4. `<TreeNode>`

```typescript
interface TreeNodeProps {
  node: ChatboxNode;
  isActive: boolean;     // Node near current scroll position
  onClick: () => void;
}
```

**Visual Spec** — circles, not boxes. State is driven by class modifiers on the
`<g class="nav-node">` wrapper; descendant SVG fill/stroke follow from CSS.

| State | Radius | Fill | Ring |
|-------|--------|------|------|
| Default | `NODE_RADIUS` (13) | `--nav-color-node-fill` | `--nav-color-node-border` |
| Active (in viewport) | `NODE_RADIUS_ACTIVE` (14) | `--nav-color-node-active` | none + `--nav-active-glow` |
| Hover | `NODE_RADIUS + 1` | unchanged | `--nav-color-accent` |

Modifier classes: `is-active`, `is-hovered`, `is-branch`, `is-bookmarked`,
`is-tag-match`, `is-search-match`. **`is-latest` is dead** — five `panel.css`
selectors still say `:not(.is-latest)` but no component emits it.

**Node Label:** the full prompt text, rendered in a `foreignObject` with
`text-overflow: ellipsis` (`pointer-events: none` so the row keeps the click).
`truncate()` in `constants.ts` is for SVG `<text>` and is only used by
`SearchPanel`. Summaries are Future Work — there is no summary field.

**Affordance anchor map.** Each control owns exactly one spot, so no two ever
share a location on the spine:

| Control | Anchor | Visibility |
|---------|--------|-----------|
| `BookmarkButton` | left gutter, `x = ROW_INSET`, above center | hover, or always when bookmarked |
| `TagButton` | left gutter, `x = ROW_INSET`, below center | hover, or always when tagged |
| `HideButton` (#167) | node top-right; mirrors to bottom-right when `NodeBadge` occupies the corner | hover only |
| `NodeBadge` | node top-right | always, branch points only |
| `CollapsedRunButton` (#167) | the **gap** between rows, on the spine | always |

The left gutter fits exactly one 16px icon column (`COLUMN_X` 44 − `ROW_INSET`
10); a third icon there would not fit, which is why hide is anchored to the node.

`HideButton` also gates `pointer-events`, unlike the bookmark/tag buttons which
only zero `opacity` and stay clickable while invisible. A control that removes a
row from view must not be a hidden click target.

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

### 3-6. `<CollapsedRunButton>` — hidden nodes (#167)

```typescript
interface CollapsedRunButtonProps {
  cx: number;    // spine x — same column as the node circles
  cy: number;    // gap midpoint, from runCenterY()
  count: number; // hidden nodes in this run
  onExpand: () => void;
}
```

Consecutive hidden nodes collapse into **one** `+ n` pill sitting on the
connector, in the gap between the two surrounding visible rows. The run consumes
**zero** vertical space — remaining rows keep their normal `NODE_STEP` spacing.
Like `NodeBadge`, the pill strokes itself with `--nav-color-bg` so the connector
line does not run through it.

Three geometry cases `runCenterY` handles — get these wrong and the pill clips
or vanishes:

| Case | y |
|------|---|
| middle / trailing run | half a step below the last visible row above it |
| leading run | half a step above the first visible row, **clamped** so it is not cut off by the top of the SVG when no ghost row sits above it |
| every node hidden | centered on a single reserved row (`totalRows` floors at 1 — an all-hidden tree is not an empty tree, so `EmptyState` must not take over) |

**Expanding is a permanent unhide**: it clears `hidden` on every node in the run
and persists it. There is no transient "peek" state — the metadata flag is the
single source of truth so the conversation DOM (#168) can subscribe to it
without drifting from the panel.

### 3-7. `<Tooltip>`

```typescript
interface TooltipProps {
  text: string;        // Original prompt
  anchorEl: HTMLElement;
}
```

- Rendered via Portal at the top of the Shadow DOM
- Max width: 320px, max height: 200px (overflow: scroll)
- Delay: shown after 300ms hover, hidden immediately on leave

### 3-8. `<ControlBar>`

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
| Completion alert | Toggle | On / Off (default On) — blinks the header message count for ~3s when response generation completes (issue #166). Placed directly above Language. |

---

## 4. Zustand Store

> Read `panel/store/panel-store.ts` for the current field list — it grows with
> every panel feature. The rules below are what matters.

**No `persist` middleware.** `chrome.storage.local` is the single source of
truth; there is no localStorage fallback. `updateSettings` mirrors the full
settings object to `chrome.storage` on every call, and `hydrateSettings` applies
an incoming patch **without** writing back — use it for storage-change
hydration and live drag-resize, or you get a write loop.

**Persisted vs transient.** Only `settings` and node metadata survive a reload.
`bookmarksOnlyFilter`, `activeTagFilters`, `searchQuery`, panel open/close flags
and `generationComplete` are all transient view state, and `setTree` resets the
filter/search ones on a conversation switch.

**Node metadata** (`sessionMetadata`, keyed by nodeId — bookmarks, tags, and
`hidden`) is refetched from `chrome.storage.local` on every `TREE_READY`, so it
is a mirror, not the store's own state. Writes are two-step and both halves are
required:

```typescript
patchNodeMetadata(node.id, { hidden: true });          // optimistic, re-renders now
setNodeMetadata(sessionId, node.id, { hidden: true }); // async persist
```

For several nodes at once use `setNodeMetadataBatch` — see
[messaging-and-storage §7](../messaging-and-storage/SKILL.md).

Store fields are enumerated exhaustively in `resetStore()` in
`tests/unit/panel-store.test.ts`; add new ones there too.

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
- Internal SVG layout is automatically recalculated via `ResizeObserver`

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
| Direction change | layout morph (CSS transition) | 300ms ease-in-out |

When reduced motion is set, all animations are disabled:
```css
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
}
```

---

## 8. Design Tokens (`--nav-*`)

> **Single source of truth:** the `:host` (light) and `:host([data-theme='dark'])`
> (dark) blocks in `panel.css`. Edit values there only.

The full token reference (Root / Shape / Surfaces / Shadow & Borders /
Typography / Spacing / Text / Accent / Nodes / Animation) is in
[design-tokens.md](design-tokens.md). Read it before adding any color, radius,
spacing, or duration to panel components — **no hardcoded px where a token
exists**.

---

## References

- [messaging-and-storage](../messaging-and-storage/SKILL.md) — message flow feeding the panel
- [detecting-branches](../detecting-branches/SKILL.md) — branch node data structure
- [analyzing-claude-dom](../analyzing-claude-dom/SKILL.md) — DOM selectors for active node tracking
