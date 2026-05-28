// Root component of the tree-map panel rendered inside Shadow DOM.
// 이슈 #12 — chrome.runtime.onMessage TREE_READY 리스너 shell + slot placeholders.
// 시각적 컴포넌트는 W4-2(treemap) / W4-3(header, controlbar)에서 채워짐.

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

  // 패널 비활성화 상태면 아무것도 렌더하지 않음
  if (!settings.panelVisible) return null;

  return (
    <div data-testid="panel-root">
      <div data-slot="header"     /> {/* 채워지는 위치: W4-3 */}
      <div data-slot="treemap"    /> {/* 채워지는 위치: W4-2 */}
      <div data-slot="controlbar" /> {/* 채워지는 위치: W4-3 */}
    </div>
  );
}
