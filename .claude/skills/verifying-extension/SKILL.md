---
name: verifying-extension
description: Definition-of-done verification workflow for ChatTree - build, tests, loading the unpacked extension, and manual checks on claude.ai. Use when finishing a task, before opening a PR, or when asked to verify that a change works in the real extension.
---

# Verifying the Extension (Definition of Done)

Copy this checklist and check off items as you complete them:

```
Verification Progress:
- [ ] Step 1: npm run build — passes with no errors
- [ ] Step 2: npm run test — all tests pass
- [ ] Step 3: npm run typecheck && npm run lint — clean (if src/ changed)
- [ ] Step 4: Manual verification on claude.ai (note Chrome version)
- [ ] Step 5: Documentation & skill maintenance check (CLAUDE.md PART 2)
```

## Step 4: Manual verification on claude.ai

Load: `chrome://extensions/` → Developer mode → Load unpacked → `dist/`
(click ↻ reload on the extension card after each rebuild, then refresh the
claude.ai tab).

Open a real conversation on claude.ai and verify, scoped to what the task touched:

- **Always:** panel appears, renders one node per user message, node click
  scrolls to the message and highlights it.
- **Content/DOM changes:** scroll a long conversation up and down — node count
  must not shrink (virtualization cache), ids stay stable.
- **Branch changes:** edit-and-resend a message → branch badge appears; switch
  branches with `‹`/`›` → tree tail updates, earlier nodes preserved.
- **Panel/UI changes:** check both light and dark themes and reduced-motion if
  animation was touched.
- **Settings changes:** change the setting in the popup/ControlBar, reload the
  tab, confirm it persisted.
- **Storage changes:** inspect `chrome.storage.local` from the service-worker
  console (`chrome://extensions` → service worker → Inspect) — check
  `tree_<sessionId>` keys and retention behavior.

Record the Chrome version tested in the PR description.

## Step 5: Documentation & skill maintenance

Run the three-point check in CLAUDE.md PART 2: does CLAUDE.md, an existing
skill, or a missing skill need an update? Propose — never apply silently.
