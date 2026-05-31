# Branch Detection

> **Purpose:** Logic for detecting chatbox branches (forks created by editing and resending messages) in Claude.ai and modeling them as a tree structure  
> **Depends on:** [`dom-analysis.md`](./dom-analysis.md) §3, §4

---

## 1. What Is a Branch?

When a user **edits** and resends a previously sent message in Claude.ai:
1. The original message is hidden and the new message is shown.
2. A **branch navigator** in the form `"1 / 2"`, `"2 / 3"` is inserted at the same position.
3. All subsequent AI responses and user messages are replaced depending on the selected branch.

```
chatbox-0: "How do I get started with Python?"
   │
   ├── Branch 1: "How do I get started with Python?" (original)
   │       └── chatbox-1-b1: "Can you recommend a book?"
   │               └── chatbox-2-b1: "What about online courses?"
   │
   └── Branch 2: "How do I use Python in production?" (edited)  ← currently active
           └── chatbox-1-b2: "Can you show me a project example?"
```

---

## 2. Key Constraints

| Constraint | Description |
|-----------|-------------|
| **Inactive branches not in DOM** | Branches not currently selected are not rendered in the DOM |
| **No history API access** | Cannot directly read messages from other branches |
| **Branch switching is a native feature** | The `‹` / `›` buttons are native Claude.ai controls — cannot be overridden |

> Therefore, **full reconstruction of the entire branch tree is not possible**.  
> This project adopts a strategy of **tracking the active branch path** + **visualizing branch occurrence points**.

---

## 3. Branch Detection Algorithm

### Step 1: Identify Branch Nodes

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

### Step 2: Build Tree Structure

```typescript
// content/tree-builder.ts

export function buildTree(nodes: ChatboxNode[]): TreeData {
  const result: ChatboxNode[] = [];
  let lastBranchNodeId: string | null = null;

  for (const node of nodes) {
    if (node.hasBranch) {
      // Branch point — set parentId to the previous branch node
      node.parentId = lastBranchNodeId;
      lastBranchNodeId = node.id;
    } else {
      // Regular node — use the immediately preceding node as parent
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

## 4. Branch Switch Detection

When the user presses `‹` / `›` to switch branches, the DOM is replaced.  
This is detected via MutationObserver to trigger a **partial tree reload**.

```typescript
// content/branch-change-watcher.ts

export function watchBranchChanges(
  container: HTMLElement,
  onBranchChange: (fromNodeId: string) => void
): () => void {

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Detect text change in branch-indicator
      if (
        mutation.type === 'characterData' &&
        (mutation.target as Text).parentElement?.matches('span.branch-indicator')
      ) {
        const humanTurn = (mutation.target as Text)
          .closest('[data-testid="human-turn"]') as HTMLElement | null;

        const navId = humanTurn?.getAttribute('data-nav-id') ?? '';
        if (navId) {
          // Debounce: process only the last event on rapid switches
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

// 150ms debounce
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedBranchChange(navId: string, cb: (id: string) => void) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => cb(navId), 150);
}
```

---

## 5. Branch Reload Strategy

After a branch switch replaces the DOM, **only nodes after the switch point** are re-scanned.

```typescript
// content/chatbox-tracker.ts (partial reload)

export function reloadFromNode(
  branchNodeId: string,
  allNodes: ChatboxNode[]
): ChatboxNode[] {
  const branchIndex = allNodes.findIndex(n => n.id === branchNodeId);
  if (branchIndex === -1) return allNodes;

  // Preserve up to and including the branch node; re-scan everything after
  const preserved = allNodes.slice(0, branchIndex + 1);

  // Re-scan DOM from branchIndex+1 onward
  const turns = document.querySelectorAll('[data-testid="human-turn"]');
  const newNodes: ChatboxNode[] = [];

  turns.forEach((el, index) => {
    if (index <= branchIndex) return; // already preserved

    const navId = `chatbox-${index}`;
    el.setAttribute('data-nav-id', navId);

    const { hasBranch, current, total } = detectBranch(el as HTMLElement);

    newNodes.push({
      id: navId,
      index,
      text: el.querySelector('[data-testid="user-message"] p')?.textContent ?? '',
      summary: '',           // summary needs to be regenerated
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

## 6. Branch Representation Rules in UI

| State | Node Color | Badge |
|-------|-----------|-------|
| Regular node | `--color-node-default` (purple) | None |
| Branch point | `--color-node-branch` (orange) | `🔀 N branches` |
| Inactive branch (inferred) | `--color-node-inactive` (gray) | `(previous branch)` |
| Currently selected node | `--color-node-active` (highlighted purple) | border highlight |

> Since inactive branch nodes do not exist in the DOM, they are **shown consolidated at the branch point node**.  
> e.g., branch point node badge → `🔀 3 branches · Current: 2nd`

---

## 7. Edge Cases

### 7-1. Nested Branches (Branches within Branches)

```
chatbox-0
  ├── Branch 1
  │     ├── chatbox-1
  │     │     ├── Branch 1-1  ← nested branch
  │     │     └── Branch 1-2
  │     └── chatbox-2
  └── Branch 2
```

- Only the currently active path exists in the DOM.
- All nodes with `branchTotal` greater than 1 are displayed as branch points.
- Handled recursively without depth limit.

### 7-2. Editing the First Message

- If `chatbox-0` has a branch, the topmost node in the tree becomes the branch point.
- Handled with `parentId: null`; a branch badge is shown at the tree root.

### 7-3. Branch Switch Attempt During Streaming

```typescript
// Ignore branch change events while streaming
function isStreaming(): boolean {
  return !!document.querySelector('[data-testid="streaming-indicator"]');
}

// Early return in observer
if (isStreaming()) return;
```

---

## 8. Test Scenarios

| Scenario | Expected Result |
|----------|----------------|
| Single message edited once | `branchTotal: 2`, branch point node created |
| Same message edited 3 times | `branchTotal: 3`, badge `🔀 3 branches` |
| New message after branch switch | Nodes after switch point re-scanned, tree updated |
| Edit after 10+ messages | Partial reload without performance degradation |
| Page refresh | Full re-scan after tree reset |

---

## References

- [`dom-analysis.md`](./dom-analysis.md) — Original DOM selector definitions
- [`architecture.md`](./architecture.md) — Branch data flow in the overall architecture
- [`ui-panel.md`](./ui-panel.md) — Branch node rendering rules
