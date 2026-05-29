import ReactDOM from 'react-dom/client';

let shadowHost: HTMLElement | null = null;
let reactRoot: ReactDOM.Root | null = null;

export function injectPanel(): void {
  if (shadowHost) destroyPanel();

  const host = document.createElement('div');
  host.id = 'chat-nav-root';

  const shadow = host.attachShadow({ mode: 'closed' });
  shadowHost = host;

  document.body.appendChild(host);

  const root = <div>Panel loading...</div>;
  reactRoot = ReactDOM.createRoot(shadow);
  reactRoot.render(root);
}

export function destroyPanel(): void {
  reactRoot?.unmount();
  reactRoot = null;

  shadowHost?.remove();
  shadowHost = null;
}
