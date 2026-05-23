### 0. Related Issue
<!-- Link the issue this PR addresses. Use "Closes #XX" to auto-close on merge. -->
Resolves #

---

### 1. Summary
<!-- What does this PR do? Why was this change necessary?
     Keep it concise — 2 to 4 sentences is ideal. -->


---

### 2. Checklist
<!-- Complete all items before requesting review. (if applicable) -->

**a. Code Quality**
- [ ] Code follows the project's style guide and naming conventions
- [ ] No unnecessary `console.log` or debug statements left in
- [ ] Complex logic is commented where needed

**b. Chrome Extension Specifics**
- [ ] Manifest permissions are minimal — no over-privileged scopes added
- [ ] Content script changes do not break host page functionality
- [ ] Background service worker is non-persistent where possible (MV3 compliant)
- [ ] Tested on latest stable Chrome

**c. Testing**
- [ ] Tested manually on all affected platforms
- [ ] Edge cases and error states have been considered
- [ ] Existing functionality is not broken

**d. Documentation**
- [ ] `README.md` updated if user-facing behavior changed
- [ ] `CHANGELOG.md` entry added (if applicable)
- [ ] Inline comments added for non-obvious code

---

### 3. Known Limitations / Follow-ups
<!-- Anything intentionally left out of scope, or follow-up issues to file after merge. -->
- 

---

### 4. Notes for Reviewer
<!-- Anything specific you'd like reviewers to focus on or be aware of. -->
