// Root component of the tree-map panel rendered inside Shadow DOM.
// Wires three cross-cutting concerns on top of the panel UI:
//   1. TREE_READY  — receive tree data from the observer (window CustomEvent).
//   2. settings sync — hydrate from chrome.storage.local and live-subscribe to
//      chrome.storage.onChanged so popup changes reflect instantly (issue 05).
//   3. theme       — follow claude.ai's light/dark theme (issue 06).

import { useEffect } from 'react';
import type { TreeData, UserSettings } from '@shared/types';
import { TREE_READY_EVENT } from '../observer';
import { STORAGE_KEYS } from '@shared/constants';
import { getSessionMetadata } from '@shared/metadata-storage';
import { usePanelStore } from './store/panel-store';
import { resolveTheme } from './theme';
import { TreeMapCanvas } from './components/TreeMapCanvas';
import { PanelShell } from './components/PanelShell';
import { Header } from './components/Header';
import { ControlBar } from './components/ControlBar';
import { TagPanel } from './components/TagPanel';
import { Tooltip } from './components/Tooltip';

export default function App({ shadowHost }: { shadowHost: HTMLElement }) {
  const setTree = usePanelStore((s) => s.setTree);
  const setSessionMetadata = usePanelStore((s) => s.setSessionMetadata);
  const hydrateSettings = usePanelStore((s) => s.hydrateSettings);
  const settings = usePanelStore((s) => s.settings);
  const collapsed = usePanelStore((s) => s.collapsed);
  const settingsOpen = usePanelStore((s) => s.settingsOpen);
  const tagPanelOpen = usePanelStore((s) => s.tagPanelOpen);

  // 1) Tree data from the content observer.
  useEffect(() => {
    const handler = (e: Event) => {
      const tree = (e as CustomEvent<{ tree: TreeData }>).detail.tree;
      setTree(tree);
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        getSessionMetadata(tree.sessionId).then(setSessionMetadata);
      }
    };
    window.addEventListener(TREE_READY_EVENT, handler);
    return () => window.removeEventListener(TREE_READY_EVENT, handler);
  }, [setTree, setSessionMetadata]);

  // 2) Settings: initial hydrate (with legacy-key migration) + live sync.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

    // Migrate settings stored under the old key used before the redesign.
    chrome.storage.local.get([STORAGE_KEYS.LEGACY_USER_SETTINGS, STORAGE_KEYS.USER_SETTINGS], (result) => {
      const legacy = result[STORAGE_KEYS.LEGACY_USER_SETTINGS] as Partial<UserSettings> | undefined;
      const current = result[STORAGE_KEYS.USER_SETTINGS] as Partial<UserSettings> | undefined;

      if (legacy && !current) {
        chrome.storage.local.set({ [STORAGE_KEYS.USER_SETTINGS]: legacy });
        chrome.storage.local.remove(STORAGE_KEYS.LEGACY_USER_SETTINGS);
        hydrateSettings(legacy);
      } else if (current) {
        chrome.storage.local.remove(STORAGE_KEYS.LEGACY_USER_SETTINGS);
        hydrateSettings(current);
      }
    });

    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'local') return;
      const change = changes[STORAGE_KEYS.USER_SETTINGS];
      if (change?.newValue) hydrateSettings(change.newValue as Partial<UserSettings>);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [hydrateSettings]);

  // 3) Apply the resolved theme to the Shadow host's data-theme attribute, and
  //    track claude.ai theme changes while in 'auto' mode.
  useEffect(() => {
    const apply = () => shadowHost.setAttribute('data-theme', resolveTheme(settings.themeMode));
    apply();

    if (settings.themeMode !== 'auto') return;
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-mode', 'style'],
    });
    return () => mo.disconnect();
  }, [settings.themeMode, shadowHost]);

  // Render nothing when the panel is hidden; the listeners above stay registered
  // so the store keeps catching updates in the background.
  if (!settings.panelVisible) return null;

  return (
    <>
      <PanelShell>
        <Header />
        {!collapsed && <TreeMapCanvas />}
        {!collapsed && settingsOpen && <ControlBar />}
        {!collapsed && tagPanelOpen && <TagPanel />}
      </PanelShell>
      <Tooltip />
    </>
  );
}
