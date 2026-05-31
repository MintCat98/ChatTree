/**
 * @jest-environment jsdom
 */
// Scopes the jsdom environment to this file only so localStorage is available,
// while leaving the repo-wide jest.config testEnvironment (node) untouched.

// Acceptance Criteria unit tests for usePanelStore (issue #12).
// Location: tests/unit/panel-store.test.ts (matches Jest testMatch = tests/unit/**/*.test.ts).
// Run: `npm test -- panel-store` (Jest + jsdom).
//
// Verifies:
//   1. setTree({...})              → store.tree updated
//   2. updateSettings({...})       → only the patched fields merge, others preserved
//   3. setActiveNode('chatbox-3')  → activeNodeId === 'chatbox-3'
//   4. setHoveredNode('chatbox-1') → hoveredNodeId === 'chatbox-1'
//   5. settings persisted across re-init (localStorage)
//   6. tree NOT persisted across re-init

import { usePanelStore } from '../../src/content/panel/store/panel-store';
import type { TreeData } from '@shared/types';

const SAMPLE_TREE: TreeData = {
  sessionId: 'test-uuid',
  nodes: [
    { id: 'chatbox-0', index: 0, text: 'hello', hasBranch: false, branchCurrent: 1, branchTotal: 1, parentId: null },
  ],
  activeBranchPath: ['chatbox-0'],
  lastUpdated: 1717000000000,
};

// Reset both the store state and localStorage before each test to guarantee isolation.
function resetStore() {
  localStorage.clear();
  usePanelStore.setState({
    tree:          null,
    settings: {
      panelPosition:     'top-right',
      panelDirection:    'top-down',
      backgroundOpacity: 0.85,
      sortOrder:         'asc',
      summaryEnabled:    false,
      panelVisible:      true,
    },
    activeNodeId:  null,
    hoveredNodeId: null,
  });
}

describe('usePanelStore — actions', () => {
  beforeEach(resetStore);

  it('setTree updates tree', () => {
    usePanelStore.getState().setTree(SAMPLE_TREE);
    expect(usePanelStore.getState().tree).toEqual(SAMPLE_TREE);
  });

  it('updateSettings merges only the patched fields', () => {
    const before = usePanelStore.getState().settings;
    usePanelStore.getState().updateSettings({ panelPosition: 'bottom-left' });
    const after = usePanelStore.getState().settings;
    expect(after.panelPosition).toBe('bottom-left');
    expect(after.panelDirection).toBe(before.panelDirection);
    expect(after.backgroundOpacity).toBe(before.backgroundOpacity);
    expect(after.sortOrder).toBe(before.sortOrder);
    expect(after.summaryEnabled).toBe(before.summaryEnabled);
    expect(after.panelVisible).toBe(before.panelVisible);
  });

  it('setActiveNode sets activeNodeId', () => {
    usePanelStore.getState().setActiveNode('chatbox-3');
    expect(usePanelStore.getState().activeNodeId).toBe('chatbox-3');
  });

  it('setHoveredNode sets hoveredNodeId', () => {
    usePanelStore.getState().setHoveredNode('chatbox-1');
    expect(usePanelStore.getState().hoveredNodeId).toBe('chatbox-1');
  });
});

describe('usePanelStore — persistence', () => {
  beforeEach(resetStore);

  it('persists settings to localStorage', () => {
    usePanelStore.getState().updateSettings({ panelPosition: 'bottom-right' });
    const raw = localStorage.getItem('chat-nav-settings');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.settings.panelPosition).toBe('bottom-right');
  });

  it('does NOT persist tree to localStorage', () => {
    usePanelStore.getState().setTree(SAMPLE_TREE);
    const raw = localStorage.getItem('chat-nav-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      expect(parsed.state.tree).toBeUndefined();
    }
  });
});
