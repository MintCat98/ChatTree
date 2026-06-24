# [FEAT] Add a "Send Feedback" button linking to the GitHub repository

> Draft for a new Feature Request issue (based on `.github/ISSUE_TEMPLATE/feature_request.yml`).
> Copy the sections below into a new issue once you open it.

## Summary

Add a button in the panel (or popup) that lets beta users quickly send feedback or report problems by opening the project's GitHub Issues page.

## Affected Area

- [x] UI / UX

## Problem Statement

We are about to publish the `v1.0.x-beta` build to the Chrome Web Store. Beta users will inevitably run into bugs and have improvement ideas, but right now there is no in-app path for them to reach us. Without an obvious channel, valuable feedback gets lost and users have no way to know where to report issues.

## Proposed Solution

Add a lightweight **"Send Feedback"** (or "Report an Issue") button to the extension UI that opens the GitHub repository's issue page in a new tab.

- Placement: panel header or the popup — wherever it is least intrusive but still discoverable.
- Behavior: clicking opens `https://github.com/MintCat98/ChatTree/issues/new/choose` in a new tab (so users land on our existing issue templates: Bug Report / Feature Request / Chore).
- Implementation note: open the link via the appropriate extension API (e.g. an anchor with `target="_blank"` or `chrome.tabs.create`), not a Content Script external call.
- Keep it minimal — an icon + label is enough; no in-app form is needed for the MVP.

## Alternatives Considered

- **In-app feedback form that posts to an external service** — rejected: requires extra permissions/backend and conflicts with the "minimum permissions" constraint. Routing users to GitHub Issues reuses our existing templates for free.
- **Email link (`mailto:`)** — rejected: harder to track, no templates, and clutters a personal inbox.

## Scope Estimate

Small — isolated change, a few hours

## Related Issues / PRs

Related to #83

## Additional Context

Targeted for the `v1.0.x-beta` Chrome Web Store release so early adopters have a clear channel for questions and improvement suggestions.
