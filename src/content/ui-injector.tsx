import ReactDOM from 'react-dom/client';

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

export function injectPanel(): void {
  if (shadowHost) return;

  const host = document.createElement('div');
  host.id = 'chat-nav-root';

  const shadow = host.attachShadow({mode: 'closed'});
  shadowHost = host;
  shadowRoot = shadow;

  document.body.appendChild(host);

  const root = <div>Panel loading...</div>;
  ReactDOM.createRoot(shadow).render(root);
}

export function destroyPanel(): void {
  shadowHost?.remove();
  shadowHost = null;
  shadowRoot = null;
}
