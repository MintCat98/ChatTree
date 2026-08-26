# ChatTree — CLAUDE.md

Behavioral guidelines + project context for Claude Code.
**Tradeoff:** These guidelines bias toward caution over speed. Use judgment on trivial tasks.

---

## PART 1. Behavioral Guidelines
*(Derived from Karpathy's observations on LLM coding pitfalls)*

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, **stop. Name what's confusing. Ask.**

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked, no abstractions for single-use code,
  no "flexibility" that wasn't requested.
- Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting. Match existing style.
- If you notice unrelated dead code, **mention it — don't delete it.**
- Remove imports/variables only if **your** changes made them unused.
- The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

- Transform tasks into verifiable goals: "fix the bug" → "write a test that
  reproduces it, then make it pass".
- For multi-step tasks, state a brief plan first: `[Step] → verify: [check]` per step.

---

## PART 2. Documentation & Skill Maintenance

**Language rule: CLAUDE.md, all skills, and all agent-facing docs MUST be
written in English**, regardless of the conversation language.

**Before finishing any task that changed behavior, contracts, or scope, run
this three-point check and report the result:**

1. **CLAUDE.md** — Did commands, core constraints, message contracts,
   conventions, or roadmap status change? If yes, update the relevant section
   (or propose the edit if the change is debatable).
2. **Existing skill** — Did you find a skill (`.claude/skills/`) that was
   wrong, incomplete, or missing a gotcha you had to discover yourself (e.g.,
   a selector change on claude.ai)? Propose a specific edit to that SKILL.md.
3. **New skill** — Did this task require non-obvious context that no skill
   captures — a repeated workflow, domain knowledge you had to reconstruct, or
   instructions the user had to spell out? Suggest a new skill (name +
   one-line description). **Never create or modify a skill silently; propose
   it and wait for approval.**

If none apply, skip this — do not mention the check in your summary.

---

## PART 3. Project Context

### Overview

Chrome Extension (Manifest V3) that injects a floating tree-map navigation panel
into **Claude.ai only (beta)**, allowing users to track and jump between chat messages.

- Branch detection: MutationObserver + DOM snapshot diff
- On-device AI, both opt-in via `summaryEnabled` (default off, toggled in the
  panel settings) and both fed by the same `SUMMARIZE_TURNS` message:
  summarization via Gemini Nano (#160) and per-turn embeddings via a bundled
  model in an offscreen document (#161). Summaries surface in the Interactive
  Map as keyword labels + a Q&A dropdown (#165); relevance is still read-only
  (`GET_RELEVANCE`) with no layout consumer. See the `running-on-device-ai`
  skill.

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
npm run dev          # watch build → dist/   (runs fetch-model first)
npm run build        # production build      (runs fetch-model first)
npm run fetch-model  # download the embedding model into public/models/ (git-ignored)
npm run typecheck    # tsc --noEmit
npm run test         # jest
npm run lint         # eslint src/**
```

`dev` / `build` need network on a clean checkout: the ~113 MB embedding model is
not committed and is fetched by the `predev` / `prebuild` hooks. See the
`running-on-device-ai` skill §4.

Load locally: `chrome://extensions/` → Developer mode → Load unpacked → `dist/`

### Project Structure

```
src/
├── background/      # Service Worker — message relay + tree cache (session-store)
├── content/         # DOM observation, chatbox tracking, branch detection, scroll nav
│   └── panel/       # React Tree Map in Shadow DOM (components/, store/, styles/)
├── offscreen/       # Offscreen document — embedding inference (#161)
├── popup/           # Extension popup (panel toggle, settings entry)
└── shared/          # types.ts, constants.ts, message-types.ts, storage utils
public/manifest.json
public/models/       # embedding model — git-ignored, fetched by predev/prebuild
scripts/fetch-model.mjs
tests/unit/
.claude/skills/      # domain knowledge & workflows for Claude (see below)
```

### Skills (Progressive Disclosure)

Domain knowledge lives in `.claude/skills/` and loads automatically when
relevant — **do not duplicate its content here**. Skills are checked into git;
changes go through normal PR review.

| Skill | Covers |
|-------|--------|
| `analyzing-claude-dom` | claude.ai selectors, chatbox ID strategy, MutationObserver, validation checklist |
| `detecting-branches` | branch detection, tree building, reload strategy, edge cases |
| `building-panel-ui` | panel components, SVG layout, Zustand store, `--nav-*` design tokens |
| `messaging-and-storage` | message contracts/flow, tree cache, hydration, retention |
| `running-on-device-ai` | summary + embedding queues, offscreen document, model delivery, bundling & storage budget |
| `verifying-extension` | definition-of-done verification workflow |

### Core Types & Message Contracts

- Full definitions: `src/shared/types.ts` (`ChatboxNode`, `TreeData`,
  `UserSettings`) and `src/shared/message-types.ts`. **Read the source — do
  not rely on copies in docs.**
- Messages: use the `message-types.ts` enum, never raw string literals. Flow
  and payload semantics: `messaging-and-storage` skill.
- **Node summaries (#158) and per-turn embeddings (#161) live in `NodeCacheEntry`**
  — a separate `chrome.storage.local` cache (`src/shared/node-cache.ts`, issue
  #159), keyed by session + node. Relevance is derived on demand (cosine sim
  between two nodes' embeddings), not stored. **Do not put `summary`/`embedding` on
  `ChatboxNode`:** `session-store.updateTree` rebuilds the tree from the DOM on
  every update and would wipe them. Embeddings are stored at reduced precision
  and `setNodeCache` serializes its writes — see the `running-on-device-ai`
  skill §6 before changing either.

### Coding Conventions

| Item | Rule |
|------|------|
| Components | React function components + Hooks only |
| CSS variables | `--nav-*` namespace — see `building-panel-ui` skill, `design-tokens.md` |
| DOM selectors | Prefer `data-testid`; never reference hashed CSS class names directly |
| Messages | Use the `message-types.ts` enum |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, ...) |

### Core Constraints

- **Minimum permissions** — `storage`, `activeTab`, `alarms`, `offscreen` only. Ask before adding any new permission.
- **CSP** — `extension_pages` allows `'wasm-unsafe-eval'` (required by onnxruntime for the #161 embedding model). Do not widen it further.
- **Shadow DOM required** — all UI injected into claude.ai must use `mode: 'closed'`.
- **No external calls from Content Script** — route through Background SW via `chrome.runtime.sendMessage`.
- **Storage** — `chrome.storage.local` for the tree cache + user prefs; the cache is bounded by a retention policy (issue #153).
- **MV3 Service Worker** — avoid long-lived `setTimeout`. Use `chrome.alarms` if needed.
- **DOM stability** — Claude.ai Tailwind class names are unstable. Always use `data-testid`. See the `analyzing-claude-dom` skill.
- **Inactive branches are not in DOM** — only the active branch path is rendered. See the `detecting-branches` skill §2.

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
| **Beta** | Interactive Map — keyword-box tree, viewport controls, edge rewiring (#162/#163/#164) | ✅ Done |
| **Beta** | On-device node summarization pipeline (#159/#160) — opt-in | ✅ Done |
| **Beta** | Summary rendering — keyword node labels + Q&A dropdown (#165) | ✅ Done |
| **Beta** | Per-turn embeddings + on-demand relevance (#189/#161) — no consumer yet | 🚧 In progress |
| **Future** | Relevance-driven map layout, other platforms | 🔮 Out of scope |

### Definition of Done

A task is complete when `npm run build` and `npm run test` pass, the change is
manually verified on claude.ai (note the Chrome version tested), and the
PART 2 maintenance check has run. Full workflow: `verifying-extension` skill.
