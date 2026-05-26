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
| Full conversation wrapper | `[data-testid="conversation-container"]` | MutationObserver root |
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

Claude.ai does not assign explicit `id` attributes to each `human-turn`.  
Therefore, **index-based virtual IDs** are assigned directly by the Content Script.

```typescript
// content-script/chatbox-tracker.ts

function assignChatboxIds(): ChatboxNode[] {
  const turns = document.querySelectorAll('[data-testid="human-turn"]');
  const nodes: ChatboxNode[] = [];

  turns.forEach((el, index) => {
    // Inject data-attribute only if not already marked
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

Scrolls to the corresponding chatbox when a node is clicked in the Tree.

```typescript
// content-script/scroll-navigator.ts

export function scrollToChatbox(navId: string): void {
  const target = document.querySelector(`[data-nav-id="${navId}"]`);
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Visual highlight (1.5 seconds)
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
| **No direct branch access** | DOM for other branches is not rendered outside the active branch |
| **DOM changes during streaming** | MutationObserver events fire excessively during AI response streaming → debouncing required |
| **No Shadow DOM** | Claude.ai does not use Shadow DOM; standard selectors work |
| **Login state check** | If `[data-testid="conversation-container"]` is absent, treat as login page |

---

## 8. Periodic Validation Checklist

The DOM structure may change with Claude.ai deployments.  
Check the following **monthly** or **when a malfunction report is received**.

- [ ] `[data-testid="conversation-container"]` exists
- [ ] `[data-testid="human-turn"]` chatbox detection works correctly
- [ ] `[data-testid="branch-navigation"]` branch detection works correctly
- [ ] `span.branch-indicator` text parsing format (`"N / M"`)
- [ ] `scrollIntoView` works correctly
