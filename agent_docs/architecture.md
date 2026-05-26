# Architecture Overview

> **Project:** Chat Navigation for AI Chatbots (I1)  
> **Platform:** Chromium Extension (Manifest V3)  
> **Target:** claude.ai  

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Chrome Extension                       │
│                                                         │
│  ┌─────────────────┐     ┌─────────────────────────┐   │
│  │  Content Script  │────▶│   Service Worker        │   │
│  │  (claude.ai)     │◀────│   (Background)          │   │
│  │                  │     │                         │   │
│  │  - DOM Observer  │     │  - State Management     │   │
│  │  - Chatbox Track │     │  - Session Store        │   │
│  │  - Scroll Nav    │     │  - AI Summary API call  │   │
│  │  - UI Injector   │     │                         │   │
│  └────────┬─────────┘     └──────────┬──────────────┘   │
│           │                          │                   │
│           │         ┌────────────────▼──────────┐       │
│           │         │      chrome.storage        │       │
│           │         │  (session tree snapshot)   │       │
│           │         └───────────────────────────┘       │
│           │                                              │
│  ┌────────▼─────────────────────────────────────────┐   │
│  │              UI Panel (Floating)                  │   │
│  │                                                   │   │
│  │   TreeMap Renderer  │  Controls  │  Settings      │   │
│  │   (React + D3/SVG)  │ (position) │ (opacity/sort) │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities

### 2-1. Content Script (`src/content/`)

| Module | File | Responsibility |
|--------|------|----------------|
| Chatbox Tracker | `chatbox-tracker.ts` | Scans DOM for chatboxes and injects `data-nav-id` |
| Observer | `observer.ts` | Detects DOM changes via MutationObserver |
| Scroll Navigator | `scroll-navigator.ts` | Scrolls to the selected node and highlights it |
| UI Injector | `ui-injector.ts` | Mounts the React app (panel) into the page via Shadow DOM |
| Page Watcher | `page-watcher.ts` | Detects SPA URL changes and triggers tree reset |
| Message Bridge | `message-bridge.ts` | Routes messages between Content and Background |

### 2-2. Service Worker (`src/background/`)

| Module | File | Responsibility |
|--------|------|----------------|
| Session Store | `session-store.ts` | Manages per-conversation tree state (`chrome.storage.session`) |
| Summary Service | `summary-service.ts` | Calls Claude API to generate chatbox summaries |
| Message Handler | `message-handler.ts` | Handles messages from Content and Popup |

### 2-3. UI Panel (`src/panel/`)

| Component | File | Responsibility |
|-----------|------|----------------|
| App Root | `App.tsx` | Manages overall panel state (Zustand) |
| TreeMap | `TreeMap.tsx` | D3-based tree rendering |
| BranchNode | `BranchNode.tsx` | Individual node (regular vs. branch) |
| ControlBar | `ControlBar.tsx` | Position, direction, and opacity settings UI |
| Tooltip | `Tooltip.tsx` | Shows original prompt on mouse-over |
| Settings | `Settings.tsx` | Full settings page accessible from Popup |

### 2-4. Popup (`src/popup/`)

- Shown when the extension icon is clicked
- Panel on/off toggle
- Entry point for default settings

---

## 3. Message Flow

```
DOM change detected
     │
     ▼
Content Script: chatbox-tracker.assignChatboxIds()
     │  ChatboxNode[] created
     ▼
Content Script → Background: { type: 'TREE_UPDATE', nodes: ChatboxNode[] }
     │
     ▼
Background: session-store.updateTree(tabId, nodes)
     │  If unsummarized node found
     ├──▶ summary-service.summarize(text)
     │         │ Claude API call
     │         ▼
     │    node.summary updated
     │
     ▼
Background → Content Script: { type: 'TREE_READY', tree: TreeData }
     │
     ▼
UI Panel: TreeMap re-renders
```

---

## 4. Data Model

### ChatboxNode

```typescript
interface ChatboxNode {
  id: string;            // "chatbox-0", "chatbox-1", ...
  index: number;         // DOM order index
  text: string;          // Full original prompt text
  summary: string;       // AI summary (max 20 chars)
  hasBranch: boolean;    // Whether branch exists
  branchCurrent: number; // Current active branch number
  branchTotal: number;   // Total branch count
  parentId: string | null; // ID of node just before the branch
  element?: HTMLElement; // DOM reference (internal to Content Script)
}
```

### TreeData

```typescript
interface TreeData {
  sessionId: string;       // Conversation UUID extracted from URL
  nodes: ChatboxNode[];
  activeBranchPath: string[]; // Array of node IDs in the currently displayed branch
  lastUpdated: number;     // timestamp
}
```

### UserSettings

```typescript
interface UserSettings {
  panelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  panelDirection: 'top-down' | 'left-right';
  backgroundOpacity: number;    // 0.0 ~ 1.0
  sortOrder: 'asc' | 'desc';   // Sort newest nodes
  summaryEnabled: boolean;
  panelVisible: boolean;
}
```

---

## 5. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Bundler | **Vite** + `crxjs` plugin | MV3 HMR support, fast builds |
| UI | **React 18** | Team familiarity, rich ecosystem |
| Tree Rendering | **D3.js** (hierarchy) | Flexible custom layouts |
| State Management | **Zustand** | Lightweight, Content Script compatible |
| Styling | **Tailwind CSS** | Prevents class collisions (prefix: `nav-`) |
| Shadow DOM | Web Components Shadow DOM | Isolates from host page CSS |
| Communication | `chrome.runtime.sendMessage` | MV3 standard |
| Storage | `chrome.storage.session` | Per-tab session isolation |
| Language | **TypeScript** | Type safety |
| Testing | **Vitest** + Playwright | Unit + E2E |

---

## 6. Security & Permission Design

### manifest.json Minimal Permission Principle

```json
{
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["https://claude.ai/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Shadow DOM Isolation

The UI panel must be mounted using Shadow DOM.

```typescript
// ui-injector.ts
const host = document.createElement('div');
host.id = 'chat-nav-root';
const shadow = host.attachShadow({ mode: 'closed' }); // closed mode recommended
document.body.appendChild(host);
ReactDOM.createRoot(shadow).render(<App />);
```

`mode: 'closed'` prevents external scripts from accessing the Shadow DOM internals.

### API Key Management

When the Claude API is needed for the summary feature:
- API key is stored encrypted in `chrome.storage.local` (AES-GCM)
- Used only in the Service Worker — never pass the key to Content Script
- Users enter it only through the popup UI

---

## 7. Build Structure

```
chat-navigation/
├── src/
│   ├── background/        # Service Worker
│   ├── content/           # Content Script
│   ├── panel/             # Floating UI (React)
│   ├── popup/             # Extension Popup (React)
│   ├── shared/            # Shared types, utilities
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── message-types.ts
│   └── manifest.json
├── agent_docs/            # AI coding agent reference docs (this folder)
├── CLAUDE.md              # AI agent entry document
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. Development Setup

```bash
# install
npm install

# development (HMR)
npm run dev
# → generates dist/ → load extension in Chrome

# build
npm run build

# type check
npm run typecheck

# tests
npm run test           # unit
npm run test:e2e       # Playwright E2E
```

---

## 9. Reference Documents

- [`dom-analysis.md`](./dom-analysis.md) — Claude.ai DOM selector details
- [`branch-detection.md`](./branch-detection.md) — Branch detection logic
- [`ui-panel.md`](./ui-panel.md) — Panel UI component details
