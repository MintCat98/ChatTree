// Shared constants: DOM selectors, storage keys, and timing values.

export const SELECTORS = {
  CHAT_CONTAINER:      '[data-testid="conversation-container"]',
  HUMAN_TURN:          '[data-testid="human-turn"]',
  USER_MESSAGE:        '[data-testid="user-message"] p',
  BRANCH_NAV:          '[data-testid="branch-navigation"]',
  BRANCH_INDICATOR:    'span.branch-indicator',
  AI_TURN:             '[data-testid="assistant-turn"]',
  AI_RESPONSE:         '[data-testid="ai-response"]',
  STREAMING_INDICATOR: '[data-testid="streaming-indicator"]',
  NAV_ID_ATTR:         'data-nav-id',
} as const;

export const STORAGE_KEYS = {
  TREE_DATA: 'chatTreeData',
  USER_SETTINGS: 'userSettings',
} as const;

export const TIMING = {
  // Debounce MutationObserver callbacks — fires excessively during AI streaming (dom-analysis §7)
  OBSERVER_DEBOUNCE:      100,
  // IntersectionObserver threshold for active-node detection
  INTERSECTION_THRESHOLD: 0.5,
} as const;

export const CHAT_URL_PATTERN = /\/chat\/([0-9a-f-]{36})/;
