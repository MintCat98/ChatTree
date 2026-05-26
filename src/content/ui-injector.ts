// Mounts the React Panel into a closed Shadow DOM attached to document.body.

let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

export function injectPanel(): void {
  // TODO: implement — create host element, attach shadow (mode: 'closed'), render <App />
  throw new Error('TODO');
}

export function destroyPanel(): void {
  shadowHost?.remove();
  shadowHost = null;
  shadowRoot = null;
}
