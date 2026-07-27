// Injects a panel-toggle button into Claude.ai's top-right header actions.
// Uses data-testid selectors only (no hashed class names) so a Claude.ai visual
// refactor doesn't silently break us — if the anchor disappears, we skip
// injection and the panel stays reachable through the extension icon.

import { STORAGE_KEYS } from '@shared/constants';
import type { UserSettings } from '@shared/types';
import { DEFAULT_SETTINGS } from '@shared/types';

const HEADER_SELECTOR = '[data-testid="page-header"]';
const ACTIONS_SELECTOR = '[data-testid="wiggle-controls-actions"]';
const TOGGLE_ID = 'chat-nav-header-toggle';

let observer: MutationObserver | null = null;

// Read current panelVisible, flip it, write back to chrome.storage.local.
// App.tsx subscribes to storage changes so the panel reacts instantly.
async function togglePanelVisible(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const result = await chrome.storage.local.get(STORAGE_KEYS.USER_SETTINGS);
  const current = (result[STORAGE_KEYS.USER_SETTINGS] ?? DEFAULT_SETTINGS) as UserSettings;
  const next: UserSettings = { ...current, panelVisible: !current.panelVisible };
  await chrome.storage.local.set({ [STORAGE_KEYS.USER_SETTINGS]: next });
}

// Build the toggle button. Inline styles keep us independent of Claude's CSS.
function createToggleButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = TOGGLE_ID;
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle ChatTree panel');
  btn.title = 'ChatTree';
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: currentColor;
    transition: background 150ms ease;
  `;
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 4.2c0-.66.54-1.2 1.2-1.2h7.6c.66 0 1.2.54 1.2 1.2v5.1c0 .66-.54 1.2-1.2 1.2H7l-3 2.5v-2.5h-0c-.66 0-1.2-.54-1.2-1.2V4.2Z"
        stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
    </svg>
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'var(--cds-fill-ghost-hover, rgba(127,127,127,0.15))';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void togglePanelVisible();
  });
  return btn;
}

// Try to attach the button next to the Share button. Idempotent.
function tryInject(): boolean {
  // Prefer the action bar that hosts the Share button (data-testid based).
  // Falls back to the page header itself if the action bar isn't present.
  const anchor =
    document.querySelector(ACTIONS_SELECTOR) ??
    document.querySelector(HEADER_SELECTOR);
  if (!anchor) return false;

  // Already injected — nothing to do.
  if (anchor.querySelector(`#${TOGGLE_ID}`)) return true;

  const btn = createToggleButton();
  // Insert at the beginning so we appear before the Share button.
  anchor.insertBefore(btn, anchor.firstChild);
  return true;
}

// Watch for header (re)mounts and re-inject on each. Scope is limited to
// #root so we don't get notified for every chat message DOM update.
export function startHeaderToggleInjector(): void {
  if (observer) return; // already running

  // Immediate attempt in case the header is already in the DOM.
  tryInject();

  observer = new MutationObserver(() => {
    tryInject();
  });
  const root = document.getElementById('root') ?? document.body;
  observer.observe(root, { childList: true, subtree: true });
}

export function stopHeaderToggleInjector(): void {
  observer?.disconnect();
  observer = null;
  document.getElementById(TOGGLE_ID)?.remove();
}