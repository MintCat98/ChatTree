# Claude.ai DOM Validation Checklist

Run monthly, or immediately when a malfunction report is received. The DOM
structure may change with Claude.ai deployments.

- [ ] `[data-testid="conversation-container"]` exists
- [ ] `[data-testid="human-turn"]` chatbox detection works correctly
- [ ] `[data-testid="branch-navigation"]` branch detection works correctly
- [ ] `span.branch-indicator` text parsing format (`"N / M"`)
- [ ] `[data-index]` wrapper exists on turns with absolute `style.top` offset (virtualization identity, SKILL.md §3)
- [ ] `[role="article"]` carries `aria-posinset` / `aria-setsize`
- [ ] `scrollIntoView` works correctly

If any item fails, update the selector table in [SKILL.md](SKILL.md) §2 and
`SELECTORS` in `src/shared/constants.ts` together.
