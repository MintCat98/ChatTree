---
name: analyzing-claude-dom
description: Claude.ai DOM structure, selectors, chatbox ID assignment, and MutationObserver setup for the content script. Use when working on src/content/ DOM detection or scroll navigation, changing selectors, debugging chatbox tracking, or when claude.ai markup changes.
---

# Claude.ai DOM Analysis

> **Target:** `claude.ai/chat/*`
> **Purpose:** DOM selector reference for chatbox detection, tracking, and branch detection in the Content Script

---

## 1. Page Structure Overview

```
<body>
  └── #__next  (Next.js root)
       └── main
            └── div[data-testid="conversation-container"]   ← full conversation container
                 ├── div[data-testid="human-turn"]          ← user chatbox (N)
                 │    ├── div[data-testid="user-message"]   ← prompt text
                 │    └── div.branch-controls               ← branch navigator (on edit)
                 └── div[data-testid="assistant-turn"]      ← AI response (N)
                      └── div[data-testid="ai-response"]
```

---

## 2. Key Selector List

### 2-1. Conversation Container

| Role | Selector | Notes |
|------|----------|-------|
| Chat container (code: `SELECTORS.CHAT_CONTAINER`) | `#main-content, main` | Bootstrap wait + MutationObserver root. Two claude.ai variants coexist (2026-07 nav rework): legacy pages have `#main-content`; new pages dropped it and wrap turns in `[data-testid="chat-stale-nav-frame"]` under `<main>` |
| Scroll area | `div.overflow-y-auto` (first inside container) | `scrollIntoView` target |

### 2-2. User Chatbox (Human Turn)

| Role | Selector | Notes |
|------|----------|-------|
| User turn wrapper | `[data-testid="human-turn"]` | One chatbox unit |
| Prompt text | `[data-testid="user-message"] p` | Summary AI input source |
| Edit button | `button[aria-label="Edit message"]` | Revealed on hover |
| Edit textarea | `textarea[data-testid="message-input"]` | After entering edit mode |

### 2-3. Branch Controls (Branch Navigation)

> These elements are dynamically inserted inside `human-turn` when a user edits and resends a message.

| Role | Selector | Example Text |
|------|----------|-------------|
| Branch wrapper | `div[data-testid="branch-navigation"]` | — |
| Previous branch button | `button[aria-label="Previous edit"]` | `‹` |
| Next branch button | `button[aria-label="Next edit"]` | `›` |
| Current/total indicator | `span.branch-indicator` | `"2 / 3"` format |

> ⚠️ **Note:** `branch-navigation` is only rendered when there are **2 or more branches**.
> It does not exist on initial messages (no branch).

### 2-4. AI Response (Assistant Turn)

| Role | Selector | Notes |
|------|----------|-------|
| AI turn wrapper | `[data-testid="assistant-turn"]` | Adjacent sibling immediately after human-turn |
| Response body | `[data-testid="ai-response"]` | Markdown rendering container |
| Response loading | `[data-testid="streaming-indicator"]` | Presence indicates streaming |

### 2-5. Input Field (Composer)

| Role | Selector | Notes |
|------|----------|-------|
| Input wrapper | `[data-testid="composer"]` | Fixed bottom |
| Textarea | `[data-testid="message-input"]` | ProseMirror-based |
| Send button | `button[aria-label="Send message"]` | |

---

## 3. Chatbox ID Assignment Strategy

> Implementation: `src/content/chatbox-tracker.ts` (`getAbsolutePosition`, `scanMounted`, `mergeMountedNodes`)

Claude.ai does not assign explicit `id` attributes to each turn, **and it
virtualizes long conversations**: turns scrolled far out of view are unmounted
from the DOM and remount later as fresh elements. This rules out two naive
strategies:

- **Reusing a pre-existing `data-nav-id`** — a remounted bubble has no
  attribute and gets an id based on the *currently mounted* set, which collides
  with ids still held by other bubbles (issue #149: mangled panel rows, clicks
  scrolling to the wrong message).
- **Enumerating mounted bubbles per scan** — a scan only sees the mounted
  window, so the tree would shrink/grow while scrolling.

Instead, identity comes from the turn's **absolute position in the
conversation**, read from the virtualized-list ancestors:

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | `closest('[data-index]')` → `data-index` | 0-based absolute turn index (user + AI turns combined). Wrapper also carries the turn's absolute scroll offset in `style.top` |
| 2 | `closest('[role="article"]')` → `aria-posinset − 1` | Accessibility standard, more stable; no scroll offset |
| 3 | DOM enumeration order | Last-resort fallback if claude.ai's DOM changes |

Rules:

- `data-nav-id="chatbox-<absIndex>"` is **unconditionally reassigned on every
  scan** — never trust an attribute left over from before a remount.
- Because absolute indices count both user and AI turns, user-message ids are
  not contiguous (`chatbox-0`, `chatbox-2`, ...). The `index` field on
  `ChatboxNode` (used for the panel's displayed numbering) is reassigned
  sequentially after each merge.
- Scanned turns accumulate in a per-session cache (`mergeMountedNodes`), so
  turns virtualized out of the DOM stay in the tree. The cache resets on
  conversation change and invalidates past a divergence point (see the
  [detecting-branches skill](../detecting-branches/SKILL.md) §5).
- The turn's absolute `top` offset is cached alongside each node for
  scroll-navigation to unmounted turns (§5).

---

## 4. MutationObserver Setup

Detects new chatbox additions and branch changes in real time.

```typescript
// content-script/observer.ts

const container = document.querySelector('[data-testid="conversation-container"]');

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      // New human-turn or assistant-turn added
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
      // Detect dynamic insertion of branch-navigation
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

## 5. Scroll Navigation Implementation

> Implementation: `src/content/scroll-navigator.ts`

Scrolls to the corresponding chatbox when a node is clicked in the Tree.

Two paths, because the target turn may have been virtualized out of the DOM:

1. **Mounted** — `querySelector('[data-nav-id="..."]')` hit: scroll its
   `div.overflow-y-auto` container by the element's offset (fallback
   `scrollIntoView`) and apply the `nav-highlight` class for 1.5 s.
2. **Unmounted** — no element with that `data-nav-id`: scroll the conversation
   container (`[data-autoscroll-container="true"]`, fallback
   `div.overflow-y-auto`) to the turn's **cached absolute offset**
   (`getCachedTop`, captured from the `[data-index]` wrapper's `style.top`
   during scanning). Claude.ai remounts the turn as it enters the viewport, so
   the highlight is applied by re-querying after a short settle delay
   (`TIMING.VIRTUAL_SCROLL_SETTLE`).

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

## 6. URL Pattern and Page Transition Detection

Since Claude.ai is an SPA (Next.js), URL changes are detected via `popstate` + `pushState` patching.

```typescript
// content-script/page-watcher.ts

// Conversation URL pattern: /chat/<uuid>
const CHAT_URL_PATTERN = /^\/chat\/[a-f0-9-]{36}$/;

function isChatPage(): boolean {
  return CHAT_URL_PATTERN.test(location.pathname);
}

// Patch History API to detect SPA routing
const _pushState = history.pushState.bind(history);
history.pushState = function (...args) {
  _pushState(...args);
  window.dispatchEvent(new Event('locationchange'));
};

window.addEventListener('locationchange', () => {
  if (isChatPage()) {
    // New conversation entered → reset tree
    chrome.runtime.sendMessage({ type: 'CHAT_PAGE_ENTERED', url: location.href });
  }
});
```

---

## 7. Known Constraints and Notes

| Item | Description |
|------|-------------|
| **CSS class instability** | Tailwind-based hashed class names may change → prefer `data-testid` |
| **Long conversations are virtualized** | Off-screen turns are removed from the DOM and remount as fresh elements — never persist references or reuse injected attributes across scans; derive identity from absolute position (§3) |
| **No direct branch access** | DOM for other branches is not rendered outside the active branch |
| **DOM changes during streaming** | MutationObserver events fire excessively during AI response streaming → debouncing required |
| **No Shadow DOM** | Claude.ai does not use Shadow DOM; standard selectors work |
| **Login state check** | If `[data-testid="conversation-container"]` is absent, treat as login page |

---

## 8. Periodic Validation

The DOM structure may change with Claude.ai deployments. Run the checklist in
[validation-checklist.md](validation-checklist.md) **monthly** or **when a
malfunction report is received**.

---

## References

- [detecting-branches](../detecting-branches/SKILL.md) — branch detection logic built on these selectors
- [messaging-and-storage](../messaging-and-storage/SKILL.md) — where detected changes are sent
