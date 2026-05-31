// Root component of the tree-map panel rendered inside Shadow DOM.
// Sets up the chrome.runtime.onMessage TREE_READY listener and exposes
// data-slot placeholders for follow-up component PRs to fill in.

import { useEffect } from 'react';
import { MessageType } from '@shared/message-types';
import type { BridgeMessage } from '@shared/message-types';
import type { TreeData } from '@shared/types';
import { usePanelStore } from './store/panel-store';

export default function App() {
  const { setTree, settings } = usePanelStore();

  useEffect(() => {
    const handler = (msg: BridgeMessage<TreeData>) => {
      if (msg.type === MessageType.TREE_READY && msg.payload) {
        setTree(msg.payload);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [setTree]);

  // Render nothing when the panel is hidden; the message listener above
  // stays registered so the store keeps catching updates in the background.
  if (!settings.panelVisible) return null;

  return (
    <div data-testid="panel-root">
      <div data-slot="header"     /> {/* Filled by a follow-up component PR */}
      <div data-slot="treemap"    /> {/* Filled by a follow-up component PR */}
      <div data-slot="controlbar" /> {/* Filled by a follow-up component PR */}
    </div>
  );
}
