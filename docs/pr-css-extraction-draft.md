### 0. Related Issue
<!-- Link the issue this PR addresses. Use "Closes #XX" to auto-close on merge. -->
Resolves #XX  <!-- the chore issue for the CSS extraction refactor -->

---

### 1. Summary
<!-- What does this PR do? Why was this change necessary?
     Keep it concise — 2 to 4 sentences is ideal. -->
Moves inline `React.CSSProperties` blocks and hover/`disabled` emulation in the panel components into class-based styles in `panel.css`. The hover-tracking `useState` in `Header` and `ControlBar` is gone, replaced by `:hover`; `TreeNode`'s five-way visual branching collapses into class modifiers (`.is-latest`, `.is-active`, `.is-hover`, `.is-branch`). Only genuinely dynamic values (drag position, panel width, background opacity) remain inline, passed through as CSS variables (`style={{ '--panel-w': ..., '--bg-alpha': ... }}`). **No visual change — visual no-op.**

---

### 2. Checklist
<!-- Complete all items before requesting review. (if applicable) -->

**a. Code Quality**
- [x] Code follows the project's style guide and naming conventions
- [x] No unnecessary `console.log` or debug statements left in
- [x] Complex logic is commented where needed (notably the reason Tooltip stays inline)

**b. Chrome Extension Specifics**
- [x] Manifest permissions are minimal — no over-privileged scopes added
- [x] Content script changes do not break host page functionality
- [x] Background service worker is non-persistent where possible (MV3 compliant)
- [x] Tested on latest stable Chrome

**c. Testing**
- [x] Tested manually on all affected platforms
- [x] Edge cases and error states have been considered (hover during drag, disabled select hover, light/dark switch)
- [x] Existing functionality is not broken

**d. Documentation**
- [ ] `README.md` updated if user-facing behavior changed — N/A (visual no-op)
- [ ] `CHANGELOG.md` entry added (if applicable) — internal refactor, skipped
- [x] Inline comments added for non-obvious code

---

### 3. Known Limitations / Follow-ups
<!-- Anything intentionally left out of scope, or follow-up issues to file after merge. -->
- **`Tooltip.tsx` intentionally stays inline.** It is rendered via a Portal to `document.body`, outside the Shadow DOM, so the `--nav-*` tokens defined on `:host` do not reach it. Unifying it would require either (a) injecting a separate `<style>` into `document.head` (risks leaking styles into the host page) or (b) repositioning the tooltip as a fixed container inside the Shadow tree. Both are larger changes and are deferred to a follow-up PR.
- **No fallback on CSS variables.** Patterns like `style={{ '--panel-w': `${w}px` }}` produce `width: 0` if the pass-through is ever missed. `PanelShell` always provides the value so this is safe today; when applying the same pattern elsewhere, prefer `var(--panel-w, 280px)` with an explicit fallback.
- **SVG attributes stay as attributes.** Coordinate attributes (`cx`/`cy`/`r`/`x`/`y`) on SVG elements are not migrated to CSS, since cross-browser support and readability tilt toward keeping them as attributes.
- **No new design tokens.** Visual tweaks and token cleanup (e.g. removing the now-dead `PANEL_WIDTH` constant) are tracked as separate follow-ups to #66 and intentionally not bundled here.

---

### 4. Notes for Reviewer
<!-- Anything specific you'd like reviewers to focus on or be aware of. -->
- **Visual no-op is the load-bearing claim.** Pre/post screenshots were taken across the matrix of (light / dark) × (idle / hover / active / latest / branch / disabled-select); no pixel-level differences were found. When reviewing, please pair each new class in `panel.css` with its consumer in the `.tsx` file to confirm the visual remains identical.
- **Class naming convention.** `nav-` prefix + component (`nav-pill`, `nav-icon-btn`, `nav-row`, `nav-select`, `nav-range`, `nav-node`, `nav-node-row`) + modifiers (`.is-latest`, `.is-active`, `.is-hover`, `.is-branch`, `.is-on`). This follows the existing `nav-resize-handle` precedent.
- **Hover useState removal.** The disappearance of `useState` imports from `Header.tsx` / `ControlBar.tsx` is intentional. Where `useState` was used for something other than hover tracking, it is preserved.
- **CSS-variable pass-through typing.** `style={{ '--panel-w': `${w}px` }}` is not a valid `React.CSSProperties` shape without a cast; the cast (`as React.CSSProperties`) is applied at the single site in `PanelShell` that uses this pattern, so the rest of the tree continues to use plain properties.
- **`disabled` selects.** The previous `{ ...controlStyle, opacity: 0.6, cursor: 'not-allowed' }` shape is replaced by `.nav-select:disabled` in CSS. Please confirm the direction select in `ControlBar` still renders identically when disabled.
- **Test impact.** There is no behavioral change, so existing unit tests pass unchanged. The project has no DOM-snapshot / visual-regression test suite today, so none is added here.
