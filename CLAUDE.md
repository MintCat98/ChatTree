# ChatTree — CLAUDE.md

Behavioral guidelines + project context for Claude Code.
**Tradeoff:** These guidelines bias toward caution over speed. Use judgment on trivial tasks.

---

## PART 1. Behavioral Guidelines
*(Derived from Karpathy's observations on LLM coding pitfalls)*

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, **stop. Name what's confusing. Ask.**

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" that wasn't requested.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, **mention it — don't delete it.**
- Remove imports/variables only if **your** changes made them unused.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add observer" → "MutationObserver fires on message add/edit, confirmed in console"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"

For multi-step tasks, state a brief plan first:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## PART 2. Keeping This Doc Current

**Before ending a task that changed behavior, contracts, or scope, check whether this file needs an update.**

- New/changed message types, core types, commands, constraints, or conventions → update the relevant section here.
- Roadmap/phase status changed (a phase completed, started, or was reprioritized) → update the Roadmap table.
- If you're unsure whether a change is significant enough to warrant an update, propose the specific edit to the user instead of silently skipping it or silently applying it.

---

## PART 3. Project Context

### Overview

Chrome Extension (Manifest V3) that injects a floating tree-map navigation panel
into **Claude.ai only (beta)**, allowing users to track and jump between chat messages.

- Branch detection: MutationObserver + DOM snapshot diff
- AI summarization: **Future Work (not yet implemented)**

### Tech Stack

| Role | Tool |
|------|------|
| Language | TypeScript (strict) |
| UI | React 18 via Shadow DOM |
| Tree rendering | Hand-rolled SVG (React components — no D3) |
| State management | Zustand (Panel), chrome.storage (Background) |
| Bundler | Webpack 5 |
| Test | Jest + ts-jest |
| Lint/Format | ESLint + Prettier — **do not replicate rules here** |

### Key Commands

```bash
npm run dev          # watch build → dist/
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run test         # jest
npm run lint         # eslint src/**
```

Load locally: `chrome://extensions/` → Developer mode → Load unpacked → `dist/`

### Project Structure

```
src/
├── background/          # Service Worker — message relay only
│   ├── index.ts
│   └── message-handler.ts
├── content/
│   ├── index.ts             # Entry point
│   ├── observer.ts          # MutationObserver
│   ├── tracker.ts           # ChatBox data model + ID assignment
│   ├── branch-detector.ts   # Branch detection logic
│   ├── scroll-navigator.ts  # Scroll to node on click
│   ├── active-node-tracker.ts # IntersectionObserver-based active node tracking
│   ├── page-watcher.ts      # SPA URL change detection
│   ├── ui-injector.ts       # Shadow DOM mount
│   ├── message-bridge.ts    # Content ↔ Background communication
│   └── panel/               # React Tree Map (Shadow DOM)
│       ├── App.tsx
│       ├── components/
│       │   ├── PanelShell.tsx
│       │   ├── Header.tsx
│       │   ├── TreeMapCanvas.tsx  # SVG rendering
│       │   ├── TreeNode.tsx
│       │   ├── NodeBadge.tsx      # Branch badge (conditional)
│       │   ├── TreeEdge.tsx
│       │   ├── Tooltip.tsx        # Mouseover original prompt
│       │   ├── ControlBar.tsx     # Direction/position/opacity/sort
│       │   └── EmptyState.tsx
│       ├── store/
│       │   └── panel-store.ts     # Zustand store
│       └── styles/
│           └── panel.css          # Shadow DOM internal styles (--nav-* vars)
├── popup/
│   └── App.tsx
└── shared/              # Types, constants, chrome.storage utils
    ├── types.ts          # ChatboxNode, TreeData, UserSettings
    ├── constants.ts
    └── message-types.ts  # Message type enum
public/manifest.json
agent_docs/              # ← task-specific docs, read before working on each area
tests/
└── unit/
```

### Agent Docs (Progressive Disclosure)

Read only the files relevant to your current task:

| File | When to read |
|------|-------------|
| `agent_docs/dom-analysis.md` | Content script, selectors, MutationObserver |
| `agent_docs/architecture.md` | Component communication, storage strategy |
| `agent_docs/branch-detection.md` | Branch snapshot & diff logic |
| `agent_docs/ui-panel.md` | Tree Map components, Shadow DOM |

### Core Types (Quick Reference)

> Full definitions: `src/shared/types.ts`

```typescript
interface ChatboxNode {
  id: string;            // "chatbox-0", "chatbox-1", ...
  index: number;
  text: string;          // Full original prompt text
  hasBranch: boolean;
  branchCurrent: number;
  branchTotal: number;
  parentId: string | null;
}

interface TreeData {
  sessionId: string;       // Conversation UUID extracted from the URL
  nodes: ChatboxNode[];
  activeBranchPath: string[];
  lastUpdated: number;
}

interface UserSettings {
  panelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  backgroundOpacity: number;  // 0.0 ~ 1.0
  sortOrder: 'asc' | 'desc';
  panelVisible: boolean;
  notifyOnComplete: boolean;  // blink header message count on generation complete (#166)
  // ...panelWidth, themeMode, maxVisibleNodes, language, panelMode — see types.ts
}
```

> The `summary` field is **not yet implemented** (Future Work). Do not add it to the type.

### Message Types (Quick Reference)

> Full definitions: `src/shared/message-types.ts`  
> Do not use raw string literals — use the enum

| `type` | Direction | payload | Description |
|--------|------|---------|------|
| `CHATBOX_ADDED` | Content → BG | — | New chatbox DOM detected |
| `BRANCH_CHANGED` | Content → BG | `{ navId, sessionId }` | Branch switch detected |
| `CHAT_PAGE_ENTERED` | Content → BG | `{ url }` | Entered a new conversation URL |
| `ACTIVE_NODE_CHANGED` | Content → BG | `{ navId }` | Active node in viewport changed |
| `TREE_UPDATE` | Content → BG | `{ nodes, sessionId }` | Request full tree recalculation |
| `GET_STORED_TREE` | Content → BG | `{ sessionId }` | Look up stored tree — request/response, for hydration (#152) |
| `TREE_READY` | BG → Content/Panel | `{ tree }` | Push after tree data is ready |
| `SCROLL_TO` | Panel → Content | `{ navId }` | Scroll request on node click |
| `SETTINGS_UPDATED` | Popup → BG | `{ settings }` | Settings changed |

### Coding Conventions

| Item | Rule |
|------|------|
| Components | React function components + Hooks only |
| CSS variables | `--nav-*` namespace — see `ui-panel.md` §8 |
| DOM selectors | Prefer `data-testid`; never reference hashed CSS class names directly |
| Messages | Use the `message-types.ts` enum |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, ...) |

### Core Constraints

- **Minimum permissions** — `storage` + `activeTab` only. Ask before adding any new permission.
- **Shadow DOM required** — all UI injected into claude.ai must use `mode: 'closed'`.
- **No external calls from Content Script** — route through Background SW via `chrome.runtime.sendMessage`.
- **Storage** — `chrome.storage.session` for tree state, `chrome.storage.local` for user prefs only.
- **MV3 Service Worker** — avoid long-lived `setTimeout`. Use `chrome.alarms` if needed.
- **DOM stability** — Claude.ai Tailwind class names are unstable. Always use `data-testid`. See `dom-analysis.md`.
- **Inactive branches are not in DOM** — only the active branch path is rendered. See `branch-detection.md` §2.

### Git Workflow

- Branch off `dev`, not `main`
- Naming: `feature/`, `fix/`, `docs/`
- PR requires 1 reviewer before merge to `dev`

### Roadmap (Beta Scope)

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Content script DOM detection + basic tree rendering | ✅ Done |
| **Phase 2** | Branch detection + branch node visualization | ✅ Done |
| **Phase 3** | Settings UI (position / direction / opacity / sort) | ✅ Done |
| **Beta** | Public beta hardening (caching, tagging, search, bug fixes) | 🚧 In progress |
| **Future** | AI summarization, other platform support | 🔮 Out of scope |

### Team

| Role | Area |
|------|------|
| PM / Lead Dev | Architecture decisions, code review, release |
| Frontend Dev | Panel UI (React + SVG), Popup |
| Content Dev | Content Script, DOM analysis, branch detection |
| QA / Docs | Test authoring, agent_docs maintenance |

### Definition of Done

A task is complete when:
1. `npm run build` passes with no errors
2. `npm run test` passes
3. Manually verified on claude.ai (note Chrome version tested)
4. Relevant `agent_docs/` updated if behavior or contracts changed