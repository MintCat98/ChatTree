# Architecture Overview

> **Project:** Chat Navigation for AI Chatbots (I1)  
> **Platform:** Chromium Extension (Manifest V3)  
> **Target:** claude.ai  
> **Last Updated:** 2025-06

---

## 1. 전체 구조도

```
┌─────────────────────────────────────────────────────────┐
│                   Chrome Extension                       │
│                                                         │
│  ┌─────────────────┐     ┌─────────────────────────┐   │
│  │  Content Script  │────▶│   Service Worker        │   │
│  │  (claude.ai)     │◀────│   (Background)          │   │
│  │                  │     │                         │   │
│  │  - DOM Observer  │     │  - State Management     │   │
│  │  - Chatbox Track │     │  - Session Store        │   │
│  │  - Scroll Nav    │     │  - AI Summary API call  │   │
│  │  - UI Injector   │     │                         │   │
│  └────────┬─────────┘     └──────────┬──────────────┘   │
│           │                          │                   │
│           │         ┌────────────────▼──────────┐       │
│           │         │      chrome.storage        │       │
│           │         │  (session tree snapshot)   │       │
│           │         └───────────────────────────┘       │
│           │                                              │
│  ┌────────▼─────────────────────────────────────────┐   │
│  │              UI Panel (Floating)                  │   │
│  │                                                   │   │
│  │   TreeMap Renderer  │  Controls  │  Settings      │   │
│  │   (React + D3/SVG)  │ (position) │ (opacity/sort) │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 컴포넌트별 책임

### 2-1. Content Script (`src/content/`)

| 모듈 | 파일 | 책임 |
|------|------|------|
| Chatbox Tracker | `chatbox-tracker.ts` | DOM에서 챗박스 탐색 및 `data-nav-id` 주입 |
| Observer | `observer.ts` | MutationObserver로 DOM 변경 감지 |
| Scroll Navigator | `scroll-navigator.ts` | 선택된 노드로 스크롤 이동 + 하이라이트 |
| UI Injector | `ui-injector.ts` | React 앱(패널)을 페이지에 Shadow DOM으로 마운트 |
| Page Watcher | `page-watcher.ts` | SPA URL 변경 감지 및 트리 초기화 트리거 |
| Message Bridge | `message-bridge.ts` | Content ↔ Background 메시지 라우팅 |

### 2-2. Service Worker (`src/background/`)

| 모듈 | 파일 | 책임 |
|------|------|------|
| Session Store | `session-store.ts` | 대화별 트리 상태 관리 (`chrome.storage.session`) |
| Summary Service | `summary-service.ts` | Claude API 호출하여 챗박스 요약 생성 |
| Message Handler | `message-handler.ts` | Content/Popup으로부터의 메시지 처리 |

### 2-3. UI Panel (`src/panel/`)

| 컴포넌트 | 파일 | 책임 |
|----------|------|------|
| App Root | `App.tsx` | 패널 전체 상태 관리 (Zustand) |
| TreeMap | `TreeMap.tsx` | D3 기반 트리 렌더링 |
| BranchNode | `BranchNode.tsx` | 개별 노드 (일반/브랜치 구분) |
| ControlBar | `ControlBar.tsx` | 위치·방향·투명도 설정 UI |
| Tooltip | `Tooltip.tsx` | 마우스오버 시 원본 프롬프트 팝업 |
| Settings | `Settings.tsx` | Popup에서 접근하는 전체 설정 페이지 |

### 2-4. Popup (`src/popup/`)

- 익스텐션 아이콘 클릭 시 표시
- 패널 on/off 토글
- 기본 설정 진입점

---

## 3. 메시지 플로우

```
DOM 변경 감지
     │
     ▼
Content Script: chatbox-tracker.assignChatboxIds()
     │  ChatboxNode[] 생성
     ▼
Content Script → Background: { type: 'TREE_UPDATE', nodes: ChatboxNode[] }
     │
     ▼
Background: session-store.updateTree(tabId, nodes)
     │  요약 미생성 노드 발견 시
     ├──▶ summary-service.summarize(text)
     │         │ Claude API 호출
     │         ▼
     │    node.summary 업데이트
     │
     ▼
Background → Content Script: { type: 'TREE_READY', tree: TreeData }
     │
     ▼
UI Panel: TreeMap 리렌더링
```

---

## 4. 데이터 모델

### ChatboxNode

```typescript
interface ChatboxNode {
  id: string;            // "chatbox-0", "chatbox-1", ...
  index: number;         // DOM 순서 인덱스
  text: string;          // 원본 프롬프트 전체 텍스트
  summary: string;       // AI 요약 (최대 20자)
  hasBranch: boolean;    // 브랜치 존재 여부
  branchCurrent: number; // 현재 활성 브랜치 번호
  branchTotal: number;   // 전체 브랜치 수
  parentId: string | null; // 브랜치 발생 직전 노드 ID
  element?: HTMLElement; // DOM 참조 (Content Script 내부 전용)
}
```

### TreeData

```typescript
interface TreeData {
  sessionId: string;       // URL에서 추출한 대화 UUID
  nodes: ChatboxNode[];
  activeBranchPath: string[]; // 현재 표시 중인 브랜치의 노드 ID 배열
  lastUpdated: number;     // timestamp
}
```

### UserSettings

```typescript
interface UserSettings {
  panelPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  panelDirection: 'top-down' | 'left-right';
  backgroundOpacity: number;    // 0.0 ~ 1.0
  sortOrder: 'asc' | 'desc';   // 최신 노드 정렬
  summaryEnabled: boolean;
  panelVisible: boolean;
}
```

---

## 5. 기술 스택

| 레이어 | 선택 | 이유 |
|--------|------|------|
| 번들러 | **Vite** + `crxjs` 플러그인 | MV3 HMR 지원, 빠른 빌드 |
| UI | **React 18** | 팀 친숙도, 풍부한 생태계 |
| 트리 렌더링 | **D3.js** (hierarchy) | 커스텀 레이아웃 자유도 |
| 상태관리 | **Zustand** | 경량, Content Script 호환 |
| 스타일 | **Tailwind CSS** | 클래스 충돌 방지 (prefix: `nav-`) |
| Shadow DOM | Web Components Shadow DOM | 호스트 페이지 CSS 격리 |
| 통신 | `chrome.runtime.sendMessage` | MV3 표준 |
| 저장 | `chrome.storage.session` | 탭별 세션 격리 |
| 언어 | **TypeScript** | 타입 안전성 |
| 테스트 | **Vitest** + Playwright | 유닛 + E2E |

---

## 6. 보안 및 권한 설계

### manifest.json 최소 권한 원칙

```json
{
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["https://claude.ai/*"],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Shadow DOM 격리

UI 패널은 반드시 Shadow DOM으로 마운트합니다.

```typescript
// ui-injector.ts
const host = document.createElement('div');
host.id = 'chat-nav-root';
const shadow = host.attachShadow({ mode: 'closed' }); // closed 모드 권장
document.body.appendChild(host);
ReactDOM.createRoot(shadow).render(<App />);
```

`mode: 'closed'`를 사용하면 외부 스크립트에서 Shadow DOM 내부에 접근할 수 없습니다.

### API Key 관리

요약 기능에 Claude API가 필요한 경우:
- API 키는 `chrome.storage.local`에 암호화 저장 (AES-GCM)
- Service Worker에서만 사용, Content Script로 키 전달 금지
- 팝업 UI를 통해서만 사용자가 직접 입력

---

## 7. 빌드 구조

```
chat-navigation/
├── src/
│   ├── background/        # Service Worker
│   ├── content/           # Content Script
│   ├── panel/             # Floating UI (React)
│   ├── popup/             # Extension Popup (React)
│   ├── shared/            # 공용 타입, 유틸리티
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   └── message-types.ts
│   └── manifest.json
├── agent_docs/            # AI 코딩 에이전트 참조 문서 (이 폴더)
├── CLAUDE.md              # AI 에이전트 진입 문서
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 8. 개발 환경 설정

```bash
# 설치
npm install

# 개발 (HMR)
npm run dev
# → dist/ 폴더 생성 → Chrome에서 확장프로그램 로드

# 빌드
npm run build

# 타입 체크
npm run typecheck

# 테스트
npm run test           # 유닛
npm run test:e2e       # Playwright E2E
```

---

## 9. 참조 문서

- [`dom-analysis.md`](./dom-analysis.md) — Claude.ai DOM 셀렉터 상세
- [`branch-detection.md`](./branch-detection.md) — 브랜치 감지 로직
- [`ui-panel.md`](./ui-panel.md) — 패널 UI 컴포넌트 상세
