// Unit tests for message-handler — Background SW message routing.

import { onMessage } from '@background/message-handler';
import { MessageType } from '@shared/message-types';
import type { BridgeMessage } from '@shared/message-types';
import type { ChatboxNode, TreeData, UserSettings } from '@shared/types';

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

beforeEach(() => {
  jest.clearAllMocks();

  mockTabsSendMessage = jest.fn().mockResolvedValue(undefined);
  mockStorageLocalSet = jest.fn().mockResolvedValue(undefined);

  (global as unknown as { chrome: typeof chrome }).chrome = {
    tabs: { sendMessage: mockTabsSendMessage },
    storage: { local: { set: mockStorageLocalSet } },
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

    expect(mockUpdateTree).toHaveBeenCalledWith(TAB_ID, nodes, 'sess-1');
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
});

// ---------------------------------------------------------------------------
// CHATBOX_ADDED
// ---------------------------------------------------------------------------

describe('CHATBOX_ADDED', () => {
  it('calls updateTree and broadcasts TREE_READY when payload has nodes', async () => {
    const nodes = [makeNode('chatbox-0')];
    const tree = makeTree(nodes);
    mockUpdateTree.mockResolvedValue(tree);

    dispatch({ type: MessageType.CHATBOX_ADDED, payload: { nodes, sessionId: 'sess-1' } }, TAB_ID);
    await flush();

    expect(mockUpdateTree).toHaveBeenCalledWith(TAB_ID, nodes, 'sess-1');
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      TAB_ID,
      expect.objectContaining({ type: MessageType.TREE_READY }),
    );
  });

  it('does not call updateTree when payload has no nodes', async () => {
    dispatch({ type: MessageType.CHATBOX_ADDED }, TAB_ID);
    await flush();

    expect(mockUpdateTree).not.toHaveBeenCalled();
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

    dispatch({ type: MessageType.BRANCH_CHANGED, payload: { navId: 'chatbox-0' } }, TAB_ID);
    await flush();

    expect(mockGetTree).toHaveBeenCalledWith(TAB_ID);
    expect(mockUpdateTree).toHaveBeenCalledWith(TAB_ID, existing.nodes, existing.sessionId, ['chatbox-0']);
    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      TAB_ID,
      expect.objectContaining({ type: MessageType.TREE_READY }),
    );
  });

  it('does nothing when getTree returns null', async () => {
    mockGetTree.mockResolvedValue(null);

    dispatch({ type: MessageType.BRANCH_CHANGED, payload: { navId: 'chatbox-0' } }, TAB_ID);
    await flush();

    expect(mockUpdateTree).not.toHaveBeenCalled();
    expect(mockTabsSendMessage).not.toHaveBeenCalled();
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
  it('calls clearTree with the tabId', async () => {
    dispatch({ type: MessageType.CHAT_PAGE_ENTERED, payload: { url: 'https://claude.ai/chat/abc' } }, TAB_ID);
    await flush();

    expect(mockClearTree).toHaveBeenCalledWith(TAB_ID);
  });

  it('does nothing when tabId is undefined', async () => {
    dispatch({ type: MessageType.CHAT_PAGE_ENTERED });
    await flush();

    expect(mockClearTree).not.toHaveBeenCalled();
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

  it('swallows the error when chrome.tabs.sendMessage rejects (tab closed)', async () => {
    mockTabsSendMessage.mockRejectedValue(new Error('No such tab'));

    await expect(
      (async () => {
        dispatch({ type: MessageType.SCROLL_TO_NODE, payload: { navId: 'x' } }, TAB_ID);
        await flush();
      })(),
    ).resolves.toBeUndefined();
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

describe('SETTINGS_CHANGE', () => {
  const settings: UserSettings = {
    panelPosition: 'top-right',
    panelDirection: 'top-down',
    backgroundOpacity: 0.85,
    sortOrder: 'asc',
    panelVisible: true,
  };

  it('saves settings to chrome.storage.local', async () => {
    dispatch({ type: MessageType.SETTINGS_CHANGE, payload: { settings } }, TAB_ID);
    await flush();

    expect(mockStorageLocalSet).toHaveBeenCalledWith(
      expect.objectContaining({ userSettings: settings }),
    );
  });

  it('works when sender.tab is null (popup origin)', async () => {
    dispatch({ type: MessageType.SETTINGS_CHANGE, payload: { settings } });
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
});
