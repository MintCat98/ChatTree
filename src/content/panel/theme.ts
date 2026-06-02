// Detect claude.ai's current theme so the (Shadow-DOM-isolated) panel can follow it.
// The panel's :host uses `all: initial`, so it never inherits the host page's theme —
// we must read it explicitly and pass it in via the host element's data-theme attribute.
//
// Strategy (most reliable first): explicit class/attribute markers → color-scheme →
// background-color luminance → OS preference. Robust regardless of how claude.ai
// happens to mark its theme. See issue 06.

export type ResolvedTheme = 'light' | 'dark';

function fromLuminance(el: Element | null): ResolvedTheme | null {
  if (!el) return null;
  const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  // Skip fully transparent backgrounds (alpha === 0) — they tell us nothing.
  if (m.length >= 4 && Number(m[3]) === 0) return null;
  const lum = (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255;
  return lum > 0.5 ? 'light' : 'dark';
}

export function detectClaudeTheme(): ResolvedTheme {
  const html = document.documentElement;

  // 1) Explicit class marker (e.g. <html class="dark">).
  const cls = html.className.toLowerCase();
  if (cls.includes('dark')) return 'dark';
  if (cls.includes('light')) return 'light';

  // 2) Explicit attribute marker (data-theme / data-mode).
  const attr = (
    html.getAttribute('data-theme') ||
    html.getAttribute('data-mode') ||
    ''
  ).toLowerCase();
  if (attr.includes('dark')) return 'dark';
  if (attr.includes('light')) return 'light';

  // 3) CSS color-scheme.
  const cs = getComputedStyle(html).colorScheme;
  if (cs.includes('dark')) return 'dark';
  if (cs.includes('light')) return 'light';

  // 4) Effective background-color luminance (body, then html).
  const byLum = fromLuminance(document.body) ?? fromLuminance(html);
  if (byLum) return byLum;

  // 5) OS preference fallback.
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Resolve the theme to apply given the user's setting.
export function resolveTheme(mode: 'auto' | 'light' | 'dark'): ResolvedTheme {
  return mode === 'auto' ? detectClaudeTheme() : mode;
}
