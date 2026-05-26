# Chat Navigator — CLAUDE.md

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

## PART 2. Project Context

### Overview

Chrome Extension (Manifest V3) that injects a floating tree-map navigation panel
into **Claude.ai only (MVP)**, allowing users to track and jump between chat messages.

- Branch detection: MutationObserver + DOM snapshot diff
- AI summarization: **Future Work (not in MVP)**

### Tech Stack

| Role | Tool |
|------|------|
| Language | TypeScript (strict) |
| UI | React 18 via Shadow DOM |
| Tree rendering | D3.js (hierarchy layout) |
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
│   ├── index.ts             # 진입점
│   ├── observer.ts          # MutationObserver
│   ├── tracker.ts           # ChatBox data model + ID assignment
│   ├── branch-detector.ts   # 브랜치 감지 로직
│   ├── scroll-navigator.ts  # 노드 클릭 시 스크롤 이동
│   ├── active-node-tracker.ts # IntersectionObserver 기반 활성 노드 추적
│   ├── page-watcher.ts      # SPA URL 변경 감지
│   ├── ui-injector.ts       # Shadow DOM 마운트
│   ├── message-bridge.ts    # Content ↔ Background 통신
│   └── panel/               # React Tree Map (Shadow DOM)
│       ├── App.tsx
│       ├── components/
│       │   ├── PanelShell.tsx
│       │   ├── Header.tsx
│       │   ├── TreeMapCanvas.tsx  # D3 렌더링
│       │   ├── TreeNode.tsx
│       │   ├── NodeBadge.tsx      # 브랜치 배지 (조건부)
│       │   ├── TreeEdge.tsx
│       │   ├── Tooltip.tsx        # 마우스오버 원본 프롬프트
│       │   ├── ControlBar.tsx     # 방향·위치·투명도·정렬
│       │   └── EmptyState.tsx
│       ├── store/
│       │   └── panel-store.ts     # Zustand 스토어
│       └── styles/
│           └── panel.css          # Shadow DOM 내부 스타일 (--nav-* 변수)
├── popup/
│   └── App.tsx
└── shared/              # Types, constants, chrome.storage utils
    ├── types.ts          # ChatboxNode, TreeData, UserSettings
    ├── constants.ts
    └── message-types.ts  # 메시지 타입 enum
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
  text: string;          // 원본 프롬프트 전체
  hasBranch: boolean;
  branchCurrent: number;
  branchTotal: number;
  parentId: string | null;
}

interface TreeData {
  sessionId: string;       // URL에서 추출한 대화 UUID
  nodes: ChatboxNode[];
  activeBranchPath: string[];
  lastUpdated: number;
}

interface UserSettings {
  panelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  panelDirection: 'top-down' | 'left-right';
  backgroundOpacity: number;  // 0.0 ~ 1.0
  sortOrder: 'asc' | 'desc';
  panelVisible: boolean;
}
```

> `summary` 필드는 **MVP에 포함되지 않습니다** (Future Work). 타입에 추가하지 마십시오.

### Message Types (Quick Reference)

> Full definitions: `src/shared/message-types.ts`  
> 문자열 리터럴 직접 사용 금지 — enum 사용

| `type` | 방향 | payload | 설명 |
|--------|------|---------|------|
| `CHATBOX_ADDED` | Content → BG | — | 새 챗박스 DOM 감지 |
| `BRANCH_CHANGED` | Content → BG | `{ navId }` | 브랜치 전환 감지 |
| `CHAT_PAGE_ENTERED` | Content → BG | `{ url }` | 새 대화 URL 진입 |
| `ACTIVE_NODE_CHANGED` | Content → BG | `{ navId }` | 뷰포트 내 활성 노드 변경 |
| `TREE_UPDATE` | Content → BG | `{ nodes }` | 전체 트리 재계산 요청 |
| `TREE_READY` | BG → Content/Panel | `{ tree }` | 트리 데이터 완성 후 푸시 |
| `SCROLL_TO` | Panel → Content | `{ navId }` | 노드 클릭 시 스크롤 요청 |
| `SETTINGS_UPDATED` | Popup → BG | `{ settings }` | 설정 변경 |

### Coding Conventions

| 항목 | 규칙 |
|------|------|
| 컴포넌트 | React 함수형 컴포넌트 + Hooks only |
| CSS 변수 | `--nav-*` 네임스페이스 — `ui-panel.md` §8 참조 |
| DOM 셀렉터 | `data-testid` 우선, 해시된 CSS 클래스명 직접 참조 금지 |
| 메시지 | `message-types.ts` enum 사용 |
| 커밋 | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, ...) |

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

### Roadmap (MVP Scope)

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Content Script DOM 감지 + 기본 트리 렌더링 | 🚧 In progress |
| **Phase 2** | 브랜치 감지 + 브랜치 노드 시각화 | ⏳ Pending |
| **Phase 3** | 설정 UI (위치 / 방향 / 투명도 / 정렬) | ⏳ Pending |
| **Future** | AI 요약, 마우스오버 툴팁, 타 플랫폼 지원 | 🔮 Out of scope |

### Team

| Role | Area |
|------|------|
| PM / Lead Dev | Architecture decisions, code review, release |
| Frontend Dev | Panel UI (React + D3), Popup |
| Content Dev | Content Script, DOM analysis, branch detection |
| QA / Docs | Test authoring, agent_docs maintenance |

### Definition of Done

A task is complete when:
1. `npm run build` passes with no errors
2. `npm run test` passes
3. Manually verified on claude.ai (note Chrome version tested)
4. Relevant `agent_docs/` updated if behavior or contracts changed