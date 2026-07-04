// Unit tests for message-handler — Background SW message routing.

import { onMessage } from '@background/message-handler';
import { MessageType } from '@shared/message-types';
import type { BridgeMessage } from '@shared/message-types';
import type { ChatboxNode, TreeData, UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

// ---------------------------------------------------------------------------
// Mock session-store
// ---------------------------------------------------------------------------

jest.mock('@background/session-store', () => ({
  getTree: jest.fn(),
  updateTree: jest.fn(),
  clearTree: jest.fn(),
}));

import { getTree, updateTree, clearTree } from '@background/session-store';

const mockGetTree = getTree as jest.MockedFunction<typeof getTree>;
const mockUpdateTree = updateTree as jest.MockedFunction<typeof updateTree>;
const mockClearTree = clearTree as jest.MockedFunction<typeof clearTree>;

// ---------------------------------------------------------------------------
// chrome API mock
// ---------------------------------------------------------------------------

let mockTabsSendMessage: jest.Mock;
let mockStorageLocalSet: jest.Mock;
let mockStorageLocalGet: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();

  mockTabsSendMessage = jest.fn().mockResolvedValue(undefined);
  mockStorageLocalSet = jest.fn().mockResolvedValue(undefined);
  mockStorageLocalGet = jest.fn().mockResolvedValue({});

  (global as unknown as { chrome: typeof chrome }).chrome = {
    tabs: { sendMessage: mockTabsSendMessage },
    storage: { local: { set: mockStorageLocalSet, get: mockStorageLocalGet } },
  } as unknown as typeof chrome;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAB_ID = 42;

function sender(tabId?: number): chrome.runtime.MessageSender {
  return tabId !== undefined
    ? { tab: { id: tabId } as chrome.tabs.Tab }
    : {};
}

function makeNode(id: string): ChatboxNode {
  return { id, index: 0, text: 'x', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null };
}

function makeTree(nodes: ChatboxNode[] = []): TreeData {
  return { sessionId: 'sess-1', nodes, activeBranchPath: [], lastUpdated: 0 };
}

function dispatch(message: BridgeMessage, tabId?: number): void {
  onMessage(message, sender(tabId), () => {});
}

// Flush all pending microtasks so async handlers inside onMessage complete
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// TREE_UPDATE
// ---------------------------------------------------------------------------

describe('TREE_UPDATE', () => {
  it('calls updateTree then broadcasts TREE_READY', async () => {
    const nodes = [makeNode('chatbox-0')];
    const tree = makeTree(nodes);
    mockUpdateTree.mockResolvedValue(tree);

    dispatch({ type: MessageType.TREE_UPDATE, payload: { nodes, sessionId: 'sess-1' } }, TAB_ID);
    await flush();

    expect(mockUpdateTree).toHaveBeenCalledWith('sess-1', nodes);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      TAB_ID,
      expect.objectContaining({ type: MessageType.TREE_READY, payload: { tree } }),
    );
  });

  it('does nothing when tabId is undefined', async () => {
    dispatch({ type: MessageType.TREE_UPDATE, payload: { nodes: [], sessionId: 'x' } });
    await flush();

    expect(mockUpdateTree).not.toHaveBeenCalled();
  });

  it('does nothing when sessionId is missing', async () => {
    dispatch({ type: MessageType.TREE_UPDATE, payload: { nodes: [], sessionId: '' } }, TAB_ID);
    await flush();

    expect(mockUpdateTree).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CHATBOX_ADDED
// ---------------------------------------------------------------------------

describe('CHATBOX_ADDED', () => {
  it('is a pure notification — does not call updateTree or broadcastToTab', async () => {
    dispatch({ type: MessageType.CHATBOX_ADDED }, TAB_ID);
    await flush();

    expect(mockUpdateTree).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// BRANCH_CHANGED
// ---------------------------------------------------------------------------

describe('BRANCH_CHANGED', () => {
  it('reads existing tree, updates with navId as activeBranchPath, broadcasts TREE_READY', async () => {
    const existing = makeTree([makeNode('chatbox-0')]);
    const updated = { ...existing, activeBranchPath: ['chatbox-0'] };
    mockGetTree.mockResolvedValue(existing);
    mockUpdateTree.mockResolvedValue(updated);

    dispatch({ type: MessageType.BRANCH_CHANGED, payload: { navId: 'chatbox-0', sessionId: 'sess-1' } }, TAB_ID);
    await flush();

    expect(mockGetTree).toHaveBeenCalledWith('sess-1');
    expect(mockUpdateTree).toHaveBeenCalledWith('sess-1', existing.nodes, ['chatbox-0']);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      TAB_ID,
      expect.objectContaining({ type: MessageType.TREE_READY }),
    );
  });

  it('does nothing when getTree returns null', async () => {
    mockGetTree.mockResolvedValue(null);

    dispatch({ type: MessageType.BRANCH_CHANGED, payload: { navId: 'chatbox-0', sessionId: 'sess-1' } }, TAB_ID);
    await flush();

    expect(mockUpdateTree).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });

  it('does nothing when sessionId is missing from the payload', async () => {
    dispatch({ type: MessageType.BRANCH_CHANGED, payload: { navId: 'chatbox-0' } }, TAB_ID);
    await flush();

    expect(mockGetTree).not.toHaveBeenCalled();
  });

  it('does nothing when tabId is undefined', async () => {
    dispatch({ type: MessageType.BRANCH_CHANGED, payload: { navId: 'chatbox-0' } });
    await flush();

    expect(mockGetTree).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CHAT_PAGE_ENTERED
// ---------------------------------------------------------------------------

describe('CHAT_PAGE_ENTERED', () => {
  it('broadcasts empty TREE_READY without clearing the stored tree (hydration source, #152)', async () => {
    dispatch({ type: MessageType.CHAT_PAGE_ENTERED, payload: { url: 'https://claude.ai/chat/abc' } }, TAB_ID);
    await flush();

    expect(mockClearTree).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      TAB_ID,
      expect.objectContaining({
        type: MessageType.TREE_READY,
        payload: { tree: expect.objectContaining({ nodes: [], activeBranchPath: [] }) },
      }),
    );
  });

  it('does nothing when tabId is undefined', async () => {
    dispatch({ type: MessageType.CHAT_PAGE_ENTERED });
    await flush();

    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ACTIVE_NODE_CHANGED
// ---------------------------------------------------------------------------

describe('ACTIVE_NODE_CHANGED', () => {
  it('does not throw (TODO path)', async () => {
    await expect(
      (async () => {
        dispatch({ type: MessageType.ACTIVE_NODE_CHANGED, payload: { navId: 'chatbox-0' } }, TAB_ID);
        await flush();
      })(),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SCROLL_TO_NODE
// ---------------------------------------------------------------------------

describe('SCROLL_TO_NODE', () => {
  it('forwards the message to the tab via chrome.tabs.sendMessage', async () => {
    const msg: BridgeMessage = { type: MessageType.SCROLL_TO_NODE, payload: { navId: 'chatbox-1' } };
    dispatch(msg, TAB_ID);
    await flush();

    expect(mockTabsSendMessage).toHaveBeenCalledWith(TAB_ID, msg);
  });

  it('silently ignores "Receiving end does not exist" (tab closed normally)', async () => {
    mockTabsSendMessage.mockRejectedValue(new Error('Receiving end does not exist'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    dispatch({ type: MessageType.SCROLL_TO_NODE, payload: { navId: 'x' } }, TAB_ID);
    await flush();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('logs a warning for unexpected broadcastToTab errors', async () => {
    mockTabsSendMessage.mockRejectedValue(new Error('Serialization failed'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    dispatch({ type: MessageType.SCROLL_TO_NODE, payload: { navId: 'x' } }, TAB_ID);
    await flush();

    expect(warnSpy).toHaveBeenCalledWith('[ChatTree] broadcastToTab failed:', expect.any(Error));
    warnSpy.mockRestore();
  });

  it('does nothing when tabId is undefined', async () => {
    dispatch({ type: MessageType.SCROLL_TO_NODE, payload: { navId: 'x' } });
    await flush();

    expect(mockTabsSendMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SETTINGS_CHANGE
// ---------------------------------------------------------------------------
// New behavior (issue 05): payload is a settings PATCH (Partial<UserSettings>).
// The handler merges it over the stored settings and writes the full object back
// to chrome.storage.local under `userSettings`. The popup now writes storage
// directly, so this path is defensive — but it must still merge correctly.

describe('SETTINGS_CHANGE', () => {
  const patch: Partial<UserSettings> = { panelPosition: 'bottom-left', themeMode: 'light' };

  it('merges the patch over stored settings and saves to chrome.storage.local', async () => {
    mockStorageLocalGet.mockResolvedValue({ userSettings: { ...DEFAULT_SETTINGS } });

    dispatch({ type: MessageType.SETTINGS_CHANGE, payload: patch }, TAB_ID);
    await flush();

    expect(mockStorageLocalSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userSettings: expect.objectContaining({
          ...DEFAULT_SETTINGS,
          panelPosition: 'bottom-left',
          themeMode: 'light',
        }),
      }),
    );
  });

  it('falls back to defaults when nothing is stored yet', async () => {
    mockStorageLocalGet.mockResolvedValue({});

    dispatch({ type: MessageType.SETTINGS_CHANGE, payload: patch }, TAB_ID);
    await flush();

    expect(mockStorageLocalSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userSettings: expect.objectContaining({ panelPosition: 'bottom-left', themeMode: 'light' }),
      }),
    );
  });

  it('works when sender.tab is null (popup origin)', async () => {
    mockStorageLocalGet.mockResolvedValue({});

    dispatch({ type: MessageType.SETTINGS_CHANGE, payload: patch });
    await flush();

    expect(mockStorageLocalSet).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// onMessage return value
// ---------------------------------------------------------------------------

describe('onMessage return value', () => {
  it('returns void (not true) — fire-and-forget pattern', () => {
    const result = onMessage(
      { type: MessageType.CHAT_PAGE_ENTERED },
      sender(TAB_ID),
      () => {},
    );

    expect(result).toBeUndefined();
  });

  it('logs a warning when handleAsync rejects unexpectedly', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Cause an unexpected rejection by making updateTree throw
    mockUpdateTree.mockRejectedValueOnce(new Error('storage quota exceeded'));

    onMessage(
      { type: MessageType.TREE_UPDATE, payload: { nodes: [], sessionId: 'sess-1' } },
      sender(TAB_ID),
      () => {},
    );
    await flush();

    expect(warnSpy).toHaveBeenCalledWith(
      '[ChatTree] handler failed:',
      MessageType.TREE_UPDATE,
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// GET_STORED_TREE (issue #152 — hydration request/response)
// ---------------------------------------------------------------------------

describe('GET_STORED_TREE', () => {
  it('returns true and responds with the stored tree', async () => {
    const tree = makeTree([makeNode('chatbox-0')]);
    mockGetTree.mockResolvedValue(tree);
    const sendResponse = jest.fn();

    const result = onMessage(
      { type: MessageType.GET_STORED_TREE, payload: { sessionId: 'sess-1' } },
      sender(TAB_ID),
      sendResponse,
    );
    await flush();

    expect(result).toBe(true); // keeps sendResponse alive across the async read
    expect(mockGetTree).toHaveBeenCalledWith('sess-1');
    expect(sendResponse).toHaveBeenCalledWith({ tree });
  });

  it('responds { tree: null } when nothing is stored', async () => {
    mockGetTree.mockResolvedValue(null);
    const sendResponse = jest.fn();

    onMessage(
      { type: MessageType.GET_STORED_TREE, payload: { sessionId: 'sess-1' } },
      sender(TAB_ID),
      sendResponse,
    );
    await flush();

    expect(sendResponse).toHaveBeenCalledWith({ tree: null });
  });

  it('responds { tree: null } immediately when sessionId is missing', async () => {
    const sendResponse = jest.fn();

    const result = onMessage(
      { type: MessageType.GET_STORED_TREE, payload: {} },
      sender(TAB_ID),
      sendResponse,
    );

    expect(result).toBeUndefined();
    expect(sendResponse).toHaveBeenCalledWith({ tree: null });
    expect(mockGetTree).not.toHaveBeenCalled();
  });

  it('responds { tree: null } when the storage read rejects', async () => {
    mockGetTree.mockRejectedValue(new Error('storage gone'));
    const sendResponse = jest.fn();

    onMessage(
      { type: MessageType.GET_STORED_TREE, payload: { sessionId: 'sess-1' } },
      sender(TAB_ID),
      sendResponse,
    );
    await flush();

    expect(sendResponse).toHaveBeenCalledWith({ tree: null });
  });
});
