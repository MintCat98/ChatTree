// src/shared/message-types.ts
// All Content ↔ Background ↔ Panel messages must use these types.
// Do NOT use string literals directly — always import from here.

export const MessageType = {
  // Content → Background
  CHATBOX_ADDED:        'CHATBOX_ADDED',
  BRANCH_CHANGED:       'BRANCH_CHANGED',
  CHAT_PAGE_ENTERED:    'CHAT_PAGE_ENTERED',
  ACTIVE_NODE_CHANGED:  'ACTIVE_NODE_CHANGED',
  TREE_UPDATE:          'TREE_UPDATE',          // payload: { nodes: ChatboxNode[], sessionId: string }

  // Background → Content / Panel
  TREE_READY:           'TREE_READY',

  // Panel → Content (via Background)
  SCROLL_TO_NODE:       'SCROLL_TO_NODE',

  // Popup → Background
  SETTINGS_CHANGE:      'SETTINGS_CHANGE',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface BridgeMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}
