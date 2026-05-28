/**
 * @jest-environment jsdom
 */
// ↑ 이 docblock은 이 파일에만 jsdom 환경 적용 (localStorage 사용 가능).
//   리포 전체 jest.config의 testEnvironment를 건드리지 않아 다른 테스트에 영향 없음.

// 이슈 #12 Acceptance Criteria — usePanelStore 단위 테스트.
// 위치: tests/unit/panel-store.test.ts  (팀 컨벤션: Jest testMatch = tests/unit/**/*.test.ts)
// 실행: `npm test -- panel-store`  (Jest + jsdom 환경 가정)
//
// 검증 항목:
//   1. setTree({...})            → store.tree 업데이트
//   2. updateSettings({...})     → 해당 필드만 머지, 나머지 유지
//   3. setActiveNode('chatbox-3') → activeNodeId === 'chatbox-3'
//   4. setHoveredNode('chatbox-1') → hoveredNodeId === 'chatbox-1'
//   5. 스토어 재초기화 후 settings 유지 (localStorage 영속화)
//   6. 스토어 재초기화 후 tree === null (영속화 제외)

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

// 각 테스트 전 스토어 상태와 localStorage를 동시에 초기화 — 테스트 격리 보장.
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
