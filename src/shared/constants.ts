// Shared constants: DOM selectors, storage keys, and timing values.

export const SELECTORS = {
  // TODO: populate with stable data-testid selectors after DOM analysis
  CHAT_CONTAINER: '',
  CHATBOX: '',
  BRANCH_BUTTON: '',
} as const;

export const STORAGE_KEYS = {
  TREE_DATA: 'chatTreeData',
  USER_SETTINGS: 'userSettings',
} as const;

export const TIMING = {
  // TODO: define debounce/throttle values (ms)
  OBSERVER_DEBOUNCE: 0,
  INTERSECTION_THRESHOLD: 0,
} as const;

export const CHAT_URL_PATTERN = /\/chat\/([0-9a-f-]{36})/;
