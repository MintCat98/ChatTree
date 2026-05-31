// Shared constants: DOM selectors, storage keys, and timing values.

export const SELECTORS = {
  CHAT_CONTAINER:         '#main-content',
  USER_MESSAGE_BUBBLE:    '[data-user-message-bubble="true"]',
  USER_MESSAGE:           '[data-testid="user-message"]',
  BRANCH_ACTIONS_WRAPPER: '[aria-label="Message actions"]',
  BRANCH_PREV_BTN:        'button[aria-label="이전 버전"]',
  BRANCH_NEXT_BTN:        'button[aria-label="다음 버전"]',
  BRANCH_INDICATOR:       'span.self-center.shrink-0.select-none.font-small.text-muted',
  STREAMING_ATTR:         'data-is-streaming',
  STREAMING_INDICATOR:    '[data-testid="streaming-indicator"]',
  AI_TURN:                '[data-testid="assistant-turn"]',
  AI_RESPONSE:            '[data-testid="ai-response"]',
  NAV_ID_ATTR:            'data-nav-id',
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
  // Debounce branch-indicator text changes — rapid ‹/› clicks produce many characterData events
  BRANCH_CHANGE_DEBOUNCE: 150,
  HIGHLIGHT_DURATION: 1500,
} as const;

export const CHAT_URL_PATTERN = /\/chat\/([0-9a-f-]{36})/;
