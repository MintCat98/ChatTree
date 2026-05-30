// Extension popup — settings UI for UserSettings (position, opacity, sort, etc.).

import React from 'react';
import ReactDOM from 'react-dom/client';

export function Popup(): React.ReactElement {
  // TODO: implement — load settings from chrome.storage.local, render controls
  return <div />;
}

const container = document.getElementById('root');
if (container) {
  ReactDOM.createRoot(container).render(<Popup />);
}
