// src/shared/message-types.ts
// All Content ↔ Background ↔ Panel messages must use these types.
// Do NOT use string literals directly — always import from here.

export const MessageType = {
  // Content → Background
  CHATBOX_ADDED: 'CHATBOX_ADDED',
  BRANCH_CHANGED: 'BRANCH_CHANGED',
  CHAT_PAGE_ENTERED: 'CHAT_PAGE_ENTERED',
  ACTIVE_NODE_CHANGED: 'ACTIVE_NODE_CHANGED',
  TREE_UPDATE: 'TREE_UPDATE', // payload: { nodes: ChatboxNode[], sessionId: string }
  SUMMARIZE_TURNS: 'SUMMARIZE_TURNS', // payload: { sessionId: string, turns: Array<{ nodeId: string, question: string, answer: string }> }
  GET_STORED_TREE: 'GET_STORED_TREE', // payload: { sessionId } — request/response; responds { tree: TreeData | null } (issue #152)

  // Background → Content / Panel
  TREE_READY: 'TREE_READY',

  // Panel → Content (via Background)
  SCROLL_TO_NODE: 'SCROLL_TO_NODE',

  // Panel → Background
  CLEAR_TREE_CACHE: 'CLEAR_TREE_CACHE', // no payload — request/response; removes all cached trees, responds { ok: boolean } (issue #153)

  // Popup → Background
  SETTINGS_CHANGE: 'SETTINGS_CHANGE',

  // Popup → Content (direct, no Background relay)
  GET_RESOLVED_THEME: 'GET_RESOLVED_THEME',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface BridgeMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}
