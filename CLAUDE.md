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
- AI summarization: Future Work (not in MVP)

### Tech Stack

| Role | Tool |
|------|------|
| Language | TypeScript (strict) |
| UI | React 18 via Shadow DOM |
| Bundler | Webpack 5 |
| Test | Jest + ts-jest |
| Lint/Format | ESLint + Prettier — **do not replicate rules here** |

### Key Commands

```bash
npm run dev      # watch build → dist/
npm run build    # production build
npm run test     # jest
npm run lint     # eslint src/**
```

Load locally: `chrome://extensions/` → Developer mode → Load unpacked → `dist/`

### Project Structure

```
src/
├── background/     # Service Worker — message relay only
├── content/
│   ├── observer.ts     # MutationObserver
│   ├── tracker.ts      # ChatBox data model
│   └── panel/          # React Tree Map (Shadow DOM)
├── popup/
└── shared/         # Types, constants, chrome.storage utils
public/manifest.json
agent_docs/         # ← task-specific docs, read before working on each area
```

### Agent Docs (Progressive Disclosure)

Read only the files relevant to your current task:

| File | When to read |
|------|-------------|
| `agent_docs/dom-analysis.md` | Content script, selectors, MutationObserver |
| `agent_docs/architecture.md` | Component communication, storage strategy |
| `agent_docs/branch-detection.md` | Branch snapshot & diff logic |
| `agent_docs/ui-panel.md` | Tree Map components, Shadow DOM |

### Core Constraints

- **Minimum permissions** — only `storage` + `activeTab`. Ask before adding any new permission.
- **Shadow DOM required** — all UI injected into claude.ai must be Shadow DOM isolated.
- **No external calls from Content Script** — route through Background SW via `chrome.runtime.sendMessage`.
- **Storage** — `chrome.storage.session` for tree state, `chrome.storage.local` for user prefs only.

### Git Workflow

- Branch off `dev`, not `main`
- Naming: `feature/`, `fix/`, `docs/`
- PR requires 1 reviewer before merge to `dev`

### Definition of Done

A task is complete when:
1. `npm run build` passes with no errors
2. `npm run test` passes
3. Manually verified on claude.ai (note Chrome version)
4. Relevant `agent_docs/` updated if behavior changed
