// Root component of the tree-map panel rendered inside Shadow DOM.
// Sets up the chrome.runtime.onMessage TREE_READY listener and exposes
// data-slot placeholders for follow-up component PRs to fill in.

import { useEffect } from 'react';
import type { TreeData } from '@shared/types';
import { TREE_READY_EVENT } from '../observer';
import { usePanelStore } from './store/panel-store';
import { TreeMapCanvas } from './components/TreeMapCanvas';
import { PanelShell } from './components/PanelShell';
import { Header } from './components/Header';
import { ControlBar } from './components/ControlBar';

export default function App() {
  const { setTree, settings } = usePanelStore();

  useEffect(() => {
    const handler = (e: Event) => {
      const tree = (e as CustomEvent<{ tree: TreeData }>).detail.tree;
      setTree(tree);
    };
    window.addEventListener(TREE_READY_EVENT, handler);
    return () => window.removeEventListener(TREE_READY_EVENT, handler);
  }, [setTree]);

  // Render nothing when the panel is hidden; the message listener above
  // stays registered so the store keeps catching updates in the background.
 // ───────────────────────────────────────────────

  if (!settings.panelVisible) return null;

  return (
    <PanelShell>
      <Header />
      <TreeMapCanvas />
      <ControlBar />
    </PanelShell>
  );
}
