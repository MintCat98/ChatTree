// src/shared/i18n.ts
// Central message catalog for all user-facing UI strings (issue #100).
//
// Why a custom catalog instead of chrome.i18n / _locales:
//   chrome.i18n resolves messages from the *browser* UI locale at load time and
//   cannot switch at runtime. Issue #100 requires a user-controlled toggle in the
//   settings panel that re-translates every component instantly. So the language
//   is a normal UserSettings field and components read strings from here.
//
// Default language is English ('en'). See DEFAULT_SETTINGS in ./types.
//
// Usage:
//   - Panel (React): const t = useMessages();  // src/content/panel/i18n.ts
//   - Popup / non-reactive: const t = getMessages(settings.language);

import type { Language } from './types';

export interface Messages {
  // Header
  expandPanel: string;
  collapsePanel: string;
  sendFeedback: string;
  settings: string;
  closePanel: string;
  support: string;
  messageCount: (n: number) => string;
  bookmarksOnly: string;
  tags: string;
  search: string;
  userGuide: string;

  // EmptyState
  emptyLine1: string;
  emptyLine2: string;

  // ControlBar (settings)
  position: string;
  positionAria: string;
  posTopLeft: string;
  posTopRight: string;
  posBottomLeft: string;
  posBottomRight: string;
  width: string;
  widthAria: string;
  opacity: string;
  opacityAria: string;
  sort: string;
  sortAscLabel: string;
  sortDescLabel: string;
  sortAria: (order: 'asc' | 'desc') => string;
  theme: string;
  themeAria: string;
  themeAuto: string;
  themeLight: string;
  themeDark: string;
  maxNodes: string;
  maxNodesAria: string;
  tooltipDelay: string;
  tooltipDelayAria: string;
  tooltipDelayReadout: (ms: number) => string;
  notifyComplete: string;
  notifyCompleteAria: string;
  notifyOnLabel: string;
  notifyOffLabel: string;
  language: string;
  languageAria: string;
  langEnglish: string;
  langKorean: string;
  retention: string;
  retentionAria: string;
  retentionDays: (n: number) => string;
  clearCache: string;
  clearCacheConfirm: string;
  clearCacheAria: string;
  resetDefaults: string;
  resetAria: string;
  panelMode: string;
  panelModeAria: string;
  panelModePopup: string;
  panelModeSidebar: string;

  // SearchPanel
  searchPlaceholder: string;
  searchAria: string;
  searchClear: string;
  searchResultCount: (n: number) => string;
  searchNoResults: string;

  // TagPanel
  tagPanelEmpty: string;
  clearTagFilter: string;
  clearTagFilterAria: string;

  // TagEditorPopover
  editTags: string;
  close: string;
  removeTag: (tag: string) => string;
  tagInputPlaceholder: string;

  // TagButton
  addTag: string;

  // BookmarkButton
  addBookmark: string;
  removeBookmark: string;

  // NodeBadge
  branchBadge: (current: number, total: number) => string;

  // TreeMapCanvas
  treeAria: string;
  earlierMessagesHint: string;
  earlierMessagesAria: string;

  // PanelShell
  resizeAria: string;

  // Popup
  loading: string;
  unsupportedTitle: string;
  unsupportedBodyPrefix: string; // text before the inline <code>claude.ai</code>
  unsupportedBodySuffix: string; // text after the inline <code>claude.ai</code>
  panelVisible: string;
}

const en: Messages = {
  // Header
  expandPanel: 'Expand panel',
  collapsePanel: 'Collapse panel',
  sendFeedback: 'Send feedback',
  settings: 'Settings',
  closePanel: 'Close panel',
  support: 'Support us',
  messageCount: (n) => `${n} messages`,
  bookmarksOnly: 'Show bookmarks only',
  tags: 'Tags',
  search: 'Search',
  userGuide: 'User guide',

  // EmptyState
  emptyLine1: 'Start a conversation',
  emptyLine2: 'and the tree will appear here.',

  // ControlBar
  position: 'Position',
  positionAria: 'Panel position',
  posTopLeft: 'Top left',
  posTopRight: 'Top right',
  posBottomLeft: 'Bottom left',
  posBottomRight: 'Bottom right',
  width: 'Width',
  widthAria: 'Panel width',
  opacity: 'Opacity',
  opacityAria: 'Background opacity',
  sort: 'Sort',
  sortAscLabel: '↑ Oldest first',
  sortDescLabel: '↓ Newest first',
  sortAria: (order) => `Current sort: ${order === 'asc' ? 'ascending' : 'descending'}`,
  theme: 'Theme',
  themeAria: 'Theme',
  themeAuto: 'Auto (follow Claude)',
  themeLight: 'Light',
  themeDark: 'Dark',
  maxNodes: 'Visible nodes',
  maxNodesAria: 'Max visible nodes',
  tooltipDelay: 'Tooltip delay',
  tooltipDelayAria: 'Delay before the prompt tooltip appears on hover',
  tooltipDelayReadout: (ms) => (ms <= 0 ? 'Instant' : `${ms}ms`),
  notifyComplete: 'Completion alert',
  notifyCompleteAria: 'Blink the message count when response generation completes',
  notifyOnLabel: 'On',
  notifyOffLabel: 'Off',
  language: 'Language',
  languageAria: 'Language',
  langEnglish: 'English',
  langKorean: '한국어',
  retention: 'Keep cache',
  retentionAria: 'Cache retention period',
  retentionDays: (n) => `${n} days`,
  clearCache: 'Clear cached trees',
  clearCacheConfirm: 'Click again to confirm',
  clearCacheAria: 'Clear all cached trees',
  resetDefaults: 'Reset to default',
  resetAria: 'Reset to default settings',
  panelMode: 'Panel mode',
  panelModeAria: 'Panel mode',
  panelModePopup: 'Popup',
  panelModeSidebar: 'Sidebar',

  // SearchPanel
  searchPlaceholder: 'Search messages...',
  searchAria: 'Search messages',
  searchClear: 'Clear search',
  searchResultCount: (n) => `${n} results`,
  searchNoResults: 'No matching messages.',

  // TagPanel
  tagPanelEmpty: 'No tags yet.',
  clearTagFilter: 'Clear filters',
  clearTagFilterAria: 'Clear tag filters',

  // TagEditorPopover
  editTags: 'Edit tags',
  close: 'Close',
  removeTag: (tag) => `Remove tag: ${tag}`,
  tagInputPlaceholder: 'Type a tag, then Enter',

  // TagButton
  addTag: 'Add tag',

  // BookmarkButton
  addBookmark: 'Add bookmark',
  removeBookmark: 'Remove bookmark',

  // NodeBadge
  branchBadge: (current, total) => `Branch ${current} of ${total}`,

  // TreeMapCanvas
  treeAria: 'Chat node tree',
  earlierMessagesHint: 'Scroll up for earlier messages',
  earlierMessagesAria: 'Jump to the top of the conversation',

  // PanelShell
  resizeAria: 'Resize panel width',

  // Popup
  loading: 'Loading…',
  unsupportedTitle: 'This page is not supported',
  unsupportedBodyPrefix: 'Use the extension on a ',
  unsupportedBodySuffix: ' chat page.',
  panelVisible: 'Show panel',
};

const ko: Messages = {
  // Header
  expandPanel: '패널 펼치기',
  collapsePanel: '패널 접기',
  sendFeedback: '피드백 보내기',
  settings: '설정',
  closePanel: '패널 닫기',
  support: '후원하기',
  messageCount: (n) => `메시지 ${n}개`,
  bookmarksOnly: '북마크만 보기',
  tags: '태그 패널',
  search: '검색',
  userGuide: '사용자 가이드',

  // EmptyState
  emptyLine1: '대화를 시작하면',
  emptyLine2: '여기에 트리가 나타납니다.',

  // ControlBar
  position: '위치',
  positionAria: '패널 위치',
  posTopLeft: '좌상단',
  posTopRight: '우상단',
  posBottomLeft: '좌하단',
  posBottomRight: '우하단',
  width: '너비',
  widthAria: '패널 너비',
  opacity: '투명도',
  opacityAria: '배경 투명도',
  sort: '정렬',
  sortAscLabel: '↑ 오래된 순',
  sortDescLabel: '↓ 최신 순',
  sortAria: (order) => `현재 정렬: ${order === 'asc' ? '오름차순' : '내림차순'}`,
  theme: '테마',
  themeAria: '테마',
  themeAuto: '자동 (Claude 따름)',
  themeLight: '라이트',
  themeDark: '다크',
  maxNodes: '노드 표시 수',
  maxNodesAria: '노드 표시 수',
  tooltipDelay: '툴팁 지연',
  tooltipDelayAria: '노드에 마우스를 올린 뒤 프롬프트 툴팁이 나타나기까지의 지연',
  tooltipDelayReadout: (ms) => (ms <= 0 ? '즉시' : `${ms}ms`),
  notifyComplete: '완료 알림',
  notifyCompleteAria: '응답 생성이 완료되면 메시지 개수를 깜빡여 알림',
  notifyOnLabel: '켜짐',
  notifyOffLabel: '꺼짐',
  language: '언어',
  languageAria: '언어',
  langEnglish: 'English',
  langKorean: '한국어',
  retention: '캐시 보관',
  retentionAria: '캐시 보관 기간',
  retentionDays: (n) => `${n}일`,
  clearCache: '캐시된 트리 삭제',
  clearCacheConfirm: '한 번 더 클릭하면 삭제',
  clearCacheAria: '캐시된 트리 전체 삭제',
  resetDefaults: '기본값으로 설정',
  resetAria: '기본값으로 재설정',
  panelMode: '패널 모드',
  panelModeAria: '패널 모드',
  panelModePopup: '팝업',
  panelModeSidebar: '사이드바',

  // SearchPanel
  searchPlaceholder: '메시지 검색...',
  searchAria: '메시지 검색',
  searchClear: '검색 초기화',
  searchResultCount: (n) => `${n}개 결과`,
  searchNoResults: '일치하는 메시지가 없습니다.',

  // TagPanel
  tagPanelEmpty: '아직 태그가 없습니다.',
  clearTagFilter: '필터 초기화',
  clearTagFilterAria: '태그 필터 초기화',

  // TagEditorPopover
  editTags: '태그 편집',
  close: '닫기',
  removeTag: (tag) => `태그 제거: ${tag}`,
  tagInputPlaceholder: '태그 입력 후 Enter',

  // TagButton
  addTag: '태그 추가',

  // BookmarkButton
  addBookmark: '북마크 추가',
  removeBookmark: '북마크 해제',

  // NodeBadge
  branchBadge: (current, total) => `브랜치 ${current}/${total}`,

  // TreeMapCanvas
  treeAria: '채팅 노드 트리',
  earlierMessagesHint: '위로 스크롤해 이전 메시지 보기',
  earlierMessagesAria: '대화 맨 위로 이동',

  // PanelShell
  resizeAria: '패널 너비 조절',

  // Popup
  loading: '불러오는 중…',
  unsupportedTitle: '이 페이지는 지원되지 않습니다',
  unsupportedBodyPrefix: '',
  unsupportedBodySuffix: ' 채팅 페이지에서 익스텐션을 사용하세요.',
  panelVisible: '패널 표시',
};

export const MESSAGES: Record<Language, Messages> = { en, ko };

// Resolve the message catalog for a language. Falls back to English so a missing
// or unexpected value never throws (e.g. settings from a future version).
export function getMessages(lang: Language): Messages {
  return MESSAGES[lang] ?? MESSAGES.en;
}
