// Handles all messages between Content Script, Panel, and Popup.

import { MessageType } from '@shared/message-types';
import type { BridgeMessage } from '@shared/message-types';
import type { ChatboxNode, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';
import { STORAGE_KEYS } from '@shared/constants';
import { getTree, updateTree, clearAllTrees } from '@background/session-store';
import { type SummaryTurn, enqueueSummaryTurns } from '@background/summary-queue';
import { getRelevance } from '@background/relevance';
import { clearAllNodeCache } from '@shared/node-cache';

export function onMessage(
  message: BridgeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  if ((message as {target?: string}).target === 'offscreen') return; // offscreen message guard (handled in embed.ts)

  // Request/response path — must return true to keep sendResponse alive
  // across the async storage read (MV3 contract).
  if (message.type === MessageType.GET_STORED_TREE) {
    const { sessionId } = (message.payload ?? {}) as { sessionId?: string };
    if (!sessionId) {
      sendResponse({ tree: null });
      return;
    }
    getTree(sessionId)
      .then((tree) => sendResponse({ tree }))
      .catch(() => sendResponse({ tree: null }));
    return true;
  }

  if (message.type === MessageType.GET_RELEVANCE) {
    const { sessionId, nodeIdA, nodeIdB } = (message.payload ?? {}) as { sessionId?: string; nodeIdA?: string; nodeIdB?: string };
    if (!sessionId || !nodeIdA || !nodeIdB) {
      sendResponse({ relevance: null });
      return;
    }

    getRelevance(sessionId, nodeIdA, nodeIdB)
      .then((relevance) => sendResponse({ relevance }))
      .catch(() => sendResponse({ relevance: null }));
    return true;
  }

  // Request/response path — removes all cached trees plus the node cache
  // (summaries/relevance) derived from them (issues #153, #159). Node metadata
  // (bookmarks/tags) has its own lifecycle and is not touched.
  if (message.type === MessageType.CLEAR_TREE_CACHE) {
    Promise.all([clearAllTrees(), clearAllNodeCache()])
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // All other messages are fire-and-forget: no sendResponse, return void.
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
      if (!sessionId) return;
      const tree = await updateTree(sessionId, nodes);
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
      // Store is keyed by sessionId (issue #152), so the payload must carry it.
      const { navId, sessionId } = message.payload as { navId: string; sessionId?: string };
      if (!sessionId) return;
      const existing = await getTree(sessionId);
      if (!existing) return;
      // activeBranchPath computation belongs to the content script (branch-detector.ts);
      // store navId as a placeholder until full branch path is provided
      const tree = await updateTree(sessionId, existing.nodes, [navId]);
      await broadcastToTab(tabId, { type: MessageType.TREE_READY, payload: { tree } });
      break;
    }

    case MessageType.CHAT_PAGE_ENTERED: {
      if (tabId === undefined) return;
      // Do NOT clear the stored tree here — it is the hydration source for the
      // conversation being entered (issue #152). Only reset the panel.
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
      // The payload is a settings PATCH (Partial<UserSettings>), not { settings }.
      // Primary sync path is now chrome.storage directly (popup writes the full
      // settings; the panel subscribes to chrome.storage.onChanged — #05).
      // This handler is kept defensive: merge the patch into the stored settings
      // so any remaining SETTINGS_CHANGE sender stays consistent.
      const patch = (message.payload ?? {}) as Partial<UserSettings>;
      const result = await chrome.storage.local.get(STORAGE_KEYS.USER_SETTINGS);
      const current = (result[STORAGE_KEYS.USER_SETTINGS] as UserSettings | undefined) ?? DEFAULT_SETTINGS;
      const next: UserSettings = { ...current, ...patch };
      await chrome.storage.local.set({ [STORAGE_KEYS.USER_SETTINGS]: next });
      break;
    }

    case MessageType.SUMMARIZE_TURNS: {
      const { sessionId, turns } = message.payload as { sessionId: string; turns: SummaryTurn[] };
      if (!sessionId || !turns?.length) return;
      enqueueSummaryTurns(sessionId, turns);
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
