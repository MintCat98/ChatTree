// src/shared/message-types.ts
// All Content ↔ Background ↔ Panel messages must use these types.
// Do NOT use string literals directly — always import from here.

export const MessageType = {
  // Content → Background
  CHATBOX_ADDED:        'CHATBOX_ADDED',
  BRANCH_CHANGED:       'BRANCH_CHANGED',
  CHAT_PAGE_ENTERED:    'CHAT_PAGE_ENTERED',
  ACTIVE_NODE_CHANGED:  'ACTIVE_NODE_CHANGED',
  TREE_UPDATE:          'TREE_UPDATE',

  // Background → Content / Panel
  TREE_READY:           'TREE_READY',

  // Panel → Content (via Background)
  SCROLL_TO:            'SCROLL_TO',

  // Popup → Background
  SETTINGS_UPDATED:     'SETTINGS_UPDATED',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

// ---------------------------------------------------------------------------
// Payload types per message
// ---------------------------------------------------------------------------

import type { ChatboxNode, TreeData, UserSettings } from './types';

export type ExtensionMessage =
  | { type: typeof MessageType.CHATBOX_ADDED }
  | { type: typeof MessageType.BRANCH_CHANGED;      navId: string }
  | { type: typeof MessageType.CHAT_PAGE_ENTERED;   url: string }
  | { type: typeof MessageType.ACTIVE_NODE_CHANGED; navId: string }
  | { type: typeof MessageType.TREE_UPDATE;         nodes: ChatboxNode[] }
  | { type: typeof MessageType.TREE_READY;          tree: TreeData }
  | { type: typeof MessageType.SCROLL_TO;           navId: string }
  | { type: typeof MessageType.SETTINGS_UPDATED;    settings: UserSettings };
