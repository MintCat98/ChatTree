# Claude.ai DOM Validation Checklist

Run monthly, or immediately when a malfunction report is received. The DOM
structure may change with Claude.ai deployments.

- [ ] `[data-testid="conversation-container"]` exists
- [ ] `[data-testid="human-turn"]` chatbox detection works correctly
- [ ] `[data-testid="branch-navigation"]` branch detection works correctly
- [ ] `span.branch-indicator` text parsing format (`"N / M"`)
- [ ] `[data-index]` wrapper exists on turns with absolute `style.top` offset (virtualization identity, SKILL.md §3)
- [ ] `[role="article"]` carries `aria-posinset` / `aria-setsize`, and it is an ancestor of the user bubble (setsize is read from there)
- [ ] During an SPA swap the previous conversation's frame is marked `inert` while it stays mounted (SKILL.md §7); if claude.ai drops the attribute, `SELECTORS.INERT_FRAME` goes dormant and only `domTrusted` guards the cache
- [ ] `[aria-label="Message actions"]` is rendered for every mounted user turn without hover, and the branch indicator sits right after the "previous version" button
- [ ] `scrollIntoView` works correctly

If any item fails, update the selector table in [SKILL.md](SKILL.md) §2 and
`SELECTORS` in `src/shared/constants.ts` together.
