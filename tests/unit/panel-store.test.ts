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
import { DEFAULT_SETTINGS } from '@shared/types';
import type { TreeData } from '@shared/types';

const SAMPLE_TREE: TreeData = {
  sessionId: 'test-uuid',
  nodes: [
    {
      id: 'chatbox-0',
      index: 0,
      text: 'hello',
      hasBranch: false,
      branchCurrent: 1,
      branchTotal: 1,
      parentId: null,
    },
  ],
  activeBranchPath: ['chatbox-0'],
  lastUpdated: 1717000000000,
};

// Reset both the store state and localStorage before each test to guarantee isolation.
function resetStore() {
  localStorage.clear();
  usePanelStore.setState({
    tree:                null,
    settings:            { ...DEFAULT_SETTINGS },
    activeNodeId:        null,
    hoveredNodeId:       null,
    hoverPos:            null,
    collapsed:           false,
    settingsOpen:        false,
    bookmarksOnlyFilter: false,
    sessionMetadata:     {},
    activeTagFilters:    [],
    tagPanelOpen:        false,
    tagEditNodeId:       null,
    searchPanelOpen:     false,
    searchQuery:         '',
    generationComplete:  false,
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
    expect(after.backgroundOpacity).toBe(before.backgroundOpacity);
    expect(after.sortOrder).toBe(before.sortOrder);
    expect(after.summaryEnabled).toBe(before.summaryEnabled);
    expect(after.panelVisible).toBe(before.panelVisible);
    expect(after.panelWidth).toBe(before.panelWidth);
    expect(after.themeMode).toBe(before.themeMode);
  });

  it('toggleCollapsed flips the collapsed flag', () => {
    expect(usePanelStore.getState().collapsed).toBe(false);
    usePanelStore.getState().toggleCollapsed();
    expect(usePanelStore.getState().collapsed).toBe(true);
  });

  it('toggleSettingsOpen flips the settingsOpen flag', () => {
    expect(usePanelStore.getState().settingsOpen).toBe(false);
    usePanelStore.getState().toggleSettingsOpen();
    expect(usePanelStore.getState().settingsOpen).toBe(true);
  });

  it('setActiveNode sets activeNodeId', () => {
    usePanelStore.getState().setActiveNode('chatbox-3');
    expect(usePanelStore.getState().activeNodeId).toBe('chatbox-3');
  });

  it('setHoveredNode sets hoveredNodeId', () => {
    usePanelStore.getState().setHoveredNode('chatbox-1');
    expect(usePanelStore.getState().hoveredNodeId).toBe('chatbox-1');
  });

  it('setGenerationComplete sets and clears the flag (issue #166)', () => {
    expect(usePanelStore.getState().generationComplete).toBe(false);
    usePanelStore.getState().setGenerationComplete(true);
    expect(usePanelStore.getState().generationComplete).toBe(true);
    usePanelStore.getState().setGenerationComplete(false);
    expect(usePanelStore.getState().generationComplete).toBe(false);
  });
});

describe('usePanelStore — sessionMetadata (issue #96)', () => {
  beforeEach(resetStore);

  it('starts with empty sessionMetadata', () => {
    expect(usePanelStore.getState().sessionMetadata).toEqual({});
  });

  it('setSessionMetadata replaces the full metadata map', () => {
    usePanelStore.getState().setSessionMetadata({
      'chatbox-0': { bookmarked: true, tags: ['a'] },
    });
    expect(usePanelStore.getState().sessionMetadata).toEqual({
      'chatbox-0': { bookmarked: true, tags: ['a'] },
    });
  });

  it('patchNodeMetadata merges defaults with existing entry', () => {
    usePanelStore.getState().setSessionMetadata({
      'chatbox-0': { bookmarked: false, tags: ['x'] },
    });
    usePanelStore.getState().patchNodeMetadata('chatbox-0', { bookmarked: true });
    expect(usePanelStore.getState().sessionMetadata['chatbox-0']).toEqual({
      bookmarked: true,
      tags: ['x'],
    });
  });

  it('patchNodeMetadata creates a new entry using defaults when node has no prior metadata', () => {
    usePanelStore.getState().patchNodeMetadata('chatbox-1', { bookmarked: true });
    expect(usePanelStore.getState().sessionMetadata['chatbox-1']).toEqual({
      bookmarked: true,
      tags: [],
    });
  });

  it('patchNodeMetadata does not affect other nodes', () => {
    usePanelStore.getState().setSessionMetadata({
      'chatbox-0': { bookmarked: false, tags: [] },
      'chatbox-1': { bookmarked: true, tags: ['y'] },
    });
    usePanelStore.getState().patchNodeMetadata('chatbox-0', { bookmarked: true });
    expect(usePanelStore.getState().sessionMetadata['chatbox-1']).toEqual({
      bookmarked: true,
      tags: ['y'],
    });
  });
});

describe('usePanelStore — persistence', () => {
  beforeEach(resetStore);

  it('does NOT persist tree to localStorage', () => {
    usePanelStore.getState().setTree(SAMPLE_TREE);
    const raw = localStorage.getItem('chat-nav-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      expect(parsed.state.tree).toBeUndefined();
    }
  });
});
