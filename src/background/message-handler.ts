// Handles all messages between Content Script, Panel, and Popup.

import { MessageType } from '@shared/message-types';
import type { BridgeMessage } from '@shared/message-types';
import type { ChatboxNode, UserSettings } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';
import { getTree, updateTree, clearTree } from '@background/session-store';

export function onMessage(
  message: BridgeMessage,
  sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): boolean | void {
  // We never call sendResponse, so return void (not true).
  handleAsync(message, sender.tab?.id).catch((err) =>
    console.warn('[ChatTree] handler failed:', message.type, err),
  );
}

async function handleAsync(
  message: BridgeMessage,
  tabId: number | undefined,
): Promise<void> {
  switch (message.type) {
    case MessageType.TREE_UPDATE: {
      if (tabId === undefined) return;
      const { nodes, sessionId } = message.payload as { nodes: ChatboxNode[]; sessionId: string };
      const tree = await updateTree(tabId, nodes, sessionId);
      await broadcastToTab(tabId, { type: MessageType.TREE_READY, payload: { tree } });
      break;
    }

    case MessageType.CHATBOX_ADDED: {
      // Pure notification — no payload. Observer detects the change, then sends
      // TREE_UPDATE with the full node list. Handled there.
      // TODO: trigger TREE_UPDATE from observer once tracker/observer wiring is complete
      break;
    }

    case MessageType.BRANCH_CHANGED: {
      if (tabId === undefined) return;
      const existing = await getTree(tabId);
      if (!existing) return;
      const { navId } = message.payload as { navId: string };
      // activeBranchPath computation belongs to the content script (branch-detector.ts);
      // store navId as a placeholder until full branch path is provided
      const tree = await updateTree(tabId, existing.nodes, existing.sessionId, [navId]);
      await broadcastToTab(tabId, { type: MessageType.TREE_READY, payload: { tree } });
      break;
    }

    case MessageType.CHAT_PAGE_ENTERED: {
      if (tabId === undefined) return;
      await clearTree(tabId);
      // Notify panel to reset — send empty tree so stale nodes are cleared immediately
      await broadcastToTab(tabId, {
        type: MessageType.TREE_READY,
        payload: { tree: { sessionId: '', nodes: [], activeBranchPath: [], lastUpdated: Date.now() } },
      });
      break;
    }

    case MessageType.ACTIVE_NODE_CHANGED: {
      // TODO: forward active node to panel once PR #36 (active-node-tracker) is merged
      break;
    }

    case MessageType.SCROLL_TO_NODE: {
      if (tabId === undefined) return;
      await broadcastToTab(tabId, message);
      break;
    }

    case MessageType.SETTINGS_CHANGE: {
      // sender.tab is null when this originates from the popup — tabId unavailable,
      // so we cannot broadcastToTab here.
      // Known Limitation: Panel must subscribe to chrome.storage.onChanged to pick up
      // setting changes in real time (to be handled in the Panel PR).
      const { settings } = message.payload as { settings: UserSettings };
      await chrome.storage.local.set({ [STORAGE_KEYS.USER_SETTINGS]: settings });
      break;
    }

    default:
      break;
  }
}

async function broadcastToTab(tabId: number, message: BridgeMessage): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // "Receiving end does not exist" / "No tab with id" — tab closed normally, ignore.
    if (!msg.includes('Receiving end does not exist') && !msg.includes('No tab with id')) {
      console.warn('[ChatTree] broadcastToTab failed:', err);
    }
  }
}
