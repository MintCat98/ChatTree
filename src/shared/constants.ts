// Shared constants: DOM selectors, storage keys, and timing values.

export const SELECTORS = {
  // Two claude.ai variants coexist (2026-07 nav rework, rolled out per browser):
  // legacy pages use #main-content; new pages dropped it — anchor on <main>.
  CHAT_CONTAINER:         '#main-content, main',
  USER_MESSAGE_BUBBLE:    '[data-cds="UserMessage"]',
  USER_MESSAGE:           '[data-testid="user-message"]',
  BRANCH_ACTIONS_WRAPPER: '[aria-label="메시지 작업"], [aria-label="Message actions"]',
  BRANCH_PREV_BTN:        'button[aria-label="이전 버전"], button[aria-label="Previous version"]',
  BRANCH_NEXT_BTN:        'button[aria-label="다음 버전"], button[aria-label="Next version"]',
  BRANCH_INDICATOR:       'span.self-center.shrink-0.select-none.font-small.text-muted',
  // Virtualized-list ancestors of each turn (issue: chat count changes on scroll).
  // TURN_INDEX_WRAPPER carries data-index (absolute turn position) and an
  // absolute `top` offset; TURN_ARTICLE carries aria-posinset as a fallback.
  TURN_INDEX_WRAPPER:     '[data-index]',
  TURN_ARTICLE:           '[role="article"]',
  SCROLL_CONTAINER:       '[data-autoscroll-container="true"]',
  STREAMING_ATTR:         'data-is-streaming',
  STREAMING_INDICATOR:    '[data-testid="streaming-indicator"]',
  CLAUDE_RESPONSE:        '.font-claude-response',
  RESPONSE_MARKDOWN:      '.standard-markdown',
  NAV_ID_ATTR:            'data-nav-id',
} as const;

// chrome.storage.local key prefix for per-conversation cached trees (issue #153).
// Shared by session-store (owner) and the orphaned-metadata GC.
export const TREE_KEY_PREFIX = 'tree_';

// chrome.storage.local key prefix for the per-conversation node cache
// (summaries #158/#160 + relevance #161, issue #159). Keyed per session like
// TREE_KEY_PREFIX so each read/write touches one conversation, not one global
// blob, and orphan GC / cache-clear can scan by prefix.
export const NODE_CACHE_KEY_PREFIX = 'nodeCache_';

// Embeddings (#161) are stored as JSON, where a full-precision component costs
// ~21 characters, making them by far the largest writer in storage.local.
// Rounding to 4 decimals holds a 384-dim vector at ~2.8 KB instead of ~8 KB
// while moving cosine similarity by <2e-4 — orders of magnitude below the
// relevance thresholds it feeds (related ≈ 0.4, same ≈ 0.9).
export const EMBEDDING_STORED_DECIMALS = 4;

export const STORAGE_KEYS = {
  TREE_DATA: 'chatTreeData',
  USER_SETTINGS: 'userSettings',
  LEGACY_USER_SETTINGS: 'settings',
  NODE_METADATA: 'nodeMetadata',  // chrome.storage.local — NodeMetadataStore (issue #96)
  SUMMARY_STATUS: 'summaryStatus', // chrome.storage.local — SummaryQueueStatus, SW → panel (issue #165)
} as const;

export const TIMING = {
  // Debounce MutationObserver callbacks — fires excessively during AI streaming (dom-analysis §7)
  OBSERVER_DEBOUNCE:      100,
  // IntersectionObserver threshold for active-node detection
  INTERSECTION_THRESHOLD: 0.5,
  // Debounce branch-indicator text changes — rapid ‹/› clicks produce many characterData events
  BRANCH_CHANGE_DEBOUNCE: 150,
  HIGHLIGHT_DURATION: 1500,
  // Wait for a virtualized bubble to remount after scrolling to its offset
  VIRTUAL_SCROLL_SETTLE: 700,
  // How long the header message count blinks after generation completes (issue #166)
  NOTIFY_BLINK_DURATION: 3000,

  SUMMARY_TIMEOUT_MS: 30_000,
  // Longer than SUMMARY_TIMEOUT_MS on purpose: the first embed of a session
  // also pays for loading the bundled model (~113 MB) and initializing the
  // onnxruntime wasm backend, which a warm call does not (issue #161).
  EMBED_TIMEOUT_MS: 60_000,
  // How long the offscreen document stays open with no embedding work before
  // closing itself, releasing the loaded model (issue #161). Long enough to
  // span the gaps between turns of one conversation, so an active chat never
  // pays to reload the model.
  OFFSCREEN_IDLE_MS: 300_000,
} as const;

export const CHAT_URL_PATTERN = /\/chat\/([0-9a-f-]{36})/;

export const GITHUB_URLS = {
  USER_GUIDE: 'https://github.com/MintCat98/ChatTree/blob/main/docs/USER_GUIDE.md',
  SPONSORS: 'https://github.com/sponsors/MintCat98',
} as const;
