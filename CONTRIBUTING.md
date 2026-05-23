# Contributing to ChatTree

First off, thank you for taking the time to contribute! 🎉  
The following is a set of guidelines for contributing to ChatTree.

---

## Table of Contents

- [Contributing to ChatTree](#contributing-to-chattree)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [How to Contribute](#how-to-contribute)
    - [1. Reporting Bugs](#1-reporting-bugs)
    - [2. Suggesting Features](#2-suggesting-features)
    - [3. Submitting Code](#3-submitting-code)
  - [Branch Strategy](#branch-strategy)
  - [Commit Message Convention](#commit-message-convention)
  - [Pull Request Process](#pull-request-process)
    - [PR Title Format](#pr-title-format)
  - [Issue Guidelines](#issue-guidelines)
    - [Labels](#labels)
  - [Development Setup](#development-setup)
  - [Questions?](#questions)

---

## Code of Conduct

- Be respectful and inclusive in all interactions.
- Constructive feedback is welcome; personal attacks are not.
- When in doubt, ask — there are no stupid questions.

---

## How to Contribute

### 1. Reporting Bugs
- Check [existing issues](../../issues) before opening a new one.
- Use the **Bug Report** issue template.
- Include browser version, extension version, and steps to reproduce.

### 2. Suggesting Features
- Use the **Feature Request** issue template.
- Explain the problem you're solving, not just the solution.

### 3. Submitting Code
- For small fixes (typos, minor bugs) → open a PR directly.
- For new features or significant changes → **open an issue first** to discuss with the core team before coding.

---

## Branch Strategy

```
main          ← stable, production-ready
dev           ← integration branch for ongoing development
feat/xxx      ← new features       (e.g. feat/tree-renderer)
fix/xxx       ← bug fixes          (e.g. fix/node-scroll-offset)
docs/xxx      ← documentation only (e.g. docs/update-readme)
chore/xxx     ← config, tooling    (e.g. chore/update-webpack)
```

- All PRs must target **`dev`**, not `main`.
- `main` is updated via a release PR from `dev` by the core team only.

---

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) standard.

```
<type>(<scope>): <short summary>

feat(content): add hover popup for node preview
fix(background): resolve message passing error on reload
docs(readme): add installation instructions
chore(deps): update webpack to v5.99
```

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructure, no feature/fix |
| `test` | Adding or updating tests |
| `chore` | Tooling, dependencies, config |

---

## Pull Request Process

1. **Fork** the repository and create your branch from `dev`.
2. Make your changes and ensure the build passes (`npm run build`).
3. Write or update tests if applicable.
4. Update relevant documentation (README, inline comments, etc.).
5. Open a PR against `dev` using the PR template.
6. **Merge requires approval from at least 2 core team members.**
7. Squash-merge is preferred to keep the commit history clean.

### PR Title Format
Follow the same convention as commit messages:
```
feat(popup): add opacity slider for navigation map
```

---

## Issue Guidelines

### Labels

| Label | Description |
|---|---|
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `question` | Further information requested |
| `wontfix` | Will not be worked on |

---

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/enhanced-navigation-for-ai-chatbots.git
cd enhanced-navigation-for-ai-chatbots

# Install dependencies
npm install

# Start dev build with watch mode
npm run dev

# Production build
npm run build
```

To load the extension locally:
1. Open `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked** → select the `/dist` folder

---

## Questions?

Open a [Discussion](../../discussions) or reach out to the core team via GitHub Issues.  
We're happy to help!
