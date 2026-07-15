---
name: messaging-and-storage
description: Extension message contracts and flow between Content Script, Background service worker, and Panel, plus the chrome.storage.local tree cache - hydration on conversation entry and retention/purge policy. Use when adding or changing message types, working on src/background/ or session-store, or changing cache, hydration, or retention behavior.
---

# Messaging & Storage

> **Purpose:** How the Content Script, Background Service Worker, and Panel
> communicate, and how tree data is cached and retained in `chrome.storage.local`.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Chrome Extension                       │
│                                                          │
│  ┌─────────────────┐      ┌─────────────────────────┐    │
│  │  Content Script  │────▶│   Service Worker         │    │
│  │  (claude.ai)     │◀────│   (Background)           │    │
│  │                  │      │                          │    │
│  │  - DOM Observer  │      │  - Message relay         │    │
│  │  - Chatbox Track │      │  - Tree cache            │    │
│  │  - Scroll Nav    │      │    (session-store.ts)    │    │
│  │  - UI Injector   │      │  - Retention purge       │    │
│  └────────┬─────────┘      └──────────┬───────────────┘    │
│           │                           │                    │
│           │          ┌────────────────▼──────────┐         │
│           │          │      chrome.storage.local  │         │
│           │          │  (tree_<sessionId> cache)  │         │
│           │          └───────────────────────────┘         │
│  ┌────────▼─────────────────────────────────────────┐      │
│  │        UI Panel (Floating, Shadow DOM)            │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

- Background modules: `src/background/index.ts`, `message-handler.ts`, `session-store.ts`
- Content ↔ Background bridge: `src/content/message-bridge.ts`
- All communication uses `chrome.runtime.sendMessage` (MV3 standard). The
  Content Script never calls external services directly.

---

## 2. Message Types

> Full definitions: `src/shared/message-types.ts`
> **Do not use raw string literals — use the enum.**

| `type` | Direction | payload | Description |
|--------|------|---------|------|
| `CHATBOX_ADDED` | Content → BG | — | New chatbox DOM detected |
| `BRANCH_CHANGED` | Content → BG | `{ navId, sessionId }` | Branch switch detected |
| `CHAT_PAGE_ENTERED` | Content → BG | `{ url }` | Entered a new conversation URL |
| `ACTIVE_NODE_CHANGED` | Content → BG | `{ navId }` | Active node in viewport changed |
| `TREE_UPDATE` | Content → BG | `{ nodes, sessionId }` | Request full tree recalculation |
| `GET_STORED_TREE` | Content → BG | `{ sessionId }` | Look up stored tree — request/response, for hydration (#152) |
| `TREE_READY` | BG → Content/Panel | `{ tree }` | Push after tree data is ready |
| `SCROLL_TO` | Panel → Content | `{ navId }` | Scroll request on node click |
| `CLEAR_TREE_CACHE` | Panel → BG | — | Remove all cached trees — request/response, responds `{ ok }` (#153) |
| `SETTINGS_UPDATED` | Popup → BG | `{ settings }` | Settings changed |

---

## 3. Main Flow (tree update)

```
DOM change detected
     │
     ▼
Content Script: chatbox-tracker.mergeMountedNodes()
     │  ChatboxNode[] created (accumulated across scans —
     │  see ../analyzing-claude-dom/SKILL.md §3)
     ▼
Content Script → Background: { type: 'TREE_UPDATE', nodes: ChatboxNode[], sessionId }
     │
     ▼
Background: session-store.updateTree(sessionId, nodes)
     │
     ▼
Background → Content Script: { type: 'TREE_READY', tree: TreeData }
     │
     ▼
UI Panel: TreeMapCanvas re-renders
```

> AI summarization is **Future Work** — no summarize step exists in this flow.
> Spike record: `docs/spikes/node-summarization.md` (#158).

---

## 4. Hydration on Conversation Entry (issue #152)

```
observer.startObserving()
     │
     ▼
Content Script → Background: { type: 'GET_STORED_TREE', sessionId }   ← request/response
     │
     ▼
Background: session-store.getTree(sessionId)  →  responds { tree: TreeData | null }
     │
     ▼
Content Script: chatbox-tracker.seedNodeCache(tree.nodes)
     │  DOM-scanned entries always win; stale seeded turns are dropped
     │  by mergeMountedNodes' divergence rule as scanning proceeds
     ▼
Tree dispatched with the full accumulated node list
```

The stored tree survives new windows, tab reloads, and browser restarts
(`chrome.storage.local`, issue #153), so a long conversation no longer starts
truncated. `CHAT_PAGE_ENTERED` must **not** clear the stored tree — it is the
hydration source.

---

## 5. Retention & Cache Clear (issue #153)

`storage.local` never self-cleans, so the Background SW bounds accumulation:

- **Daily purge alarm** (`tree-cache-purge`, `chrome.alarms`, 24 h) + once on
  `chrome.runtime.onStartup`: removes trees whose `lastUpdated` is older than
  `UserSettings.cacheRetentionDays` (default 30). Every `updateTree` refreshes
  `lastUpdated`, so the horizon means "days since last visit/update".
- **Orphaned-metadata GC** runs right after the tree purge (order matters — the
  orphan check must see the post-purge tree set): node metadata (bookmarks/tags,
  issue #96) for sessions with **no cached tree** and untouched for
  `METADATA_RETENTION_DAYS` (180) is dropped. Metadata is user data, not a
  rebuildable cache — it re-attaches on revisit via deterministic position-based
  node IDs — hence the far more conservative horizon than the tree cache.
- **Quota safety net**: if a tree write hits the 10 MB `storage.local` quota,
  `updateTree` evicts the oldest quarter of cached trees (never the one being
  written) and retries once.
- **Manual clear** (`CLEAR_TREE_CACHE`, Panel → BG request/response): removes
  all `tree_*` keys, leaves node metadata untouched; the panel then calls
  `observer.rescanFromDom()` so the current conversation re-renders from the
  live DOM instead of going blank.

---

## 6. Storage Keys

| Key | Owner | Contents |
|-----|-------|----------|
| `tree_<sessionId>` | Background (`session-store.ts`) | Cached `TreeData` per conversation — subject to retention purge |
| Node metadata (bookmarks/tags, #96) | `src/shared/metadata-storage.ts` | User data, **not** a rebuildable cache — 180-day orphan GC only |
| `chat-nav-settings` | Panel Zustand `persist` (localStorage inside Shadow DOM context) | Persisted `UserSettings` only |

---

## References

- [analyzing-claude-dom](../analyzing-claude-dom/SKILL.md) — how DOM changes are detected and identified
- [detecting-branches](../detecting-branches/SKILL.md) — how the node list is built before `TREE_UPDATE`
- [building-panel-ui](../building-panel-ui/SKILL.md) — how `TREE_READY` is consumed
