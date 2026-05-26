// Root component of the tree-map panel rendered inside Shadow DOM.

import React from 'react';
import { usePanelStore } from './store/panel-store';
import { PanelShell } from './components/PanelShell';

export function App(): React.ReactElement {
  const _store = usePanelStore();
  // TODO: implement — wire store to PanelShell and sub-components
  return <PanelShell />;
}
