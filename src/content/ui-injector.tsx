import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './panel/App';
import panelCss from './panel/styles/panel.css?raw';

let shadowHost: HTMLElement | null = null;
let reactRoot: ReactDOM.Root | null = null;

export function injectPanel(): void {
  if (shadowHost) destroyPanel();

  const host = document.createElement('div');
  host.id = 'chat-nav-root';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadowHost = host;

  const style = document.createElement('style');
  style.textContent = panelCss;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);

  document.body.appendChild(host);

  reactRoot = ReactDOM.createRoot(container);
  reactRoot.render(<App />);
}

export function destroyPanel(): void {
  reactRoot?.unmount();
  reactRoot = null;

  shadowHost?.remove();
  shadowHost = null;
}
