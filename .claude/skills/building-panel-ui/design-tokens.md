# Design Tokens (`--nav-*`)

> **Single source of truth:** the `:host` (light) and `:host([data-theme='dark'])`
> (dark) blocks in `src/content/panel/styles/panel.css`. Edit values there only.
> Groups below mirror the comment sections in that file 1:1.
>
> Dark theme overrides colors and sets `color-scheme: dark`; structural groups
> (Shape, Typography, Animation, z-index) are theme-independent.

## Root
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `color-scheme` | `light` | `dark` | Native control rendering (`<select>` options, scrollbars) — #127 |
| `--nav-z-index` | `2147483647` | — | Top layer (max) |

## Shape
| Token | Value | Purpose |
|---|---|---|
| `--nav-border-width` | `1px` | Default hairline border width |
| `--nav-border-radius` | `16px` | Panel corners |
| `--nav-border-radius-sm` | `9px` | Controls / inputs |
| `--nav-radius-md` | `8px` | Tooltip, scrollbar thumb, header icon |
| `--nav-radius-pill` | `999px` | Pill badges / buttons / chips / range track |

## Surfaces
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-bg` | `#ffffff` | `#1e1b18` | Panel background (opaque) |
| `--nav-color-bg-rgb` | `255 255 255` | `30 27 24` | Composed with `--bg-alpha` in PanelShell |
| `--nav-color-surface-2` | `#f7f5f1` | `rgba(255,255,255,.06)` | Hover / fill surface |

## Shadow & Borders
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-panel-shadow` | warm soft shadow | deeper dark shadow | Panel drop shadow |
| `--nav-color-border` | `#e9e5df` | `rgba(255,255,255,.1)` | Panel/control hairline |
| `--nav-color-divider` | `#efece7` | `rgba(255,255,255,.08)` | Section divider |

## Typography
| Token | Value | Purpose |
|---|---|---|
| `--nav-font-family` | `'Inter', -apple-system, …` | UI font |
| `--nav-font-size-xs` | `10px` | Badges, tooltip labels, small chips |
| `--nav-font-size-sm` | `11px` | Small text |
| `--nav-font-size-md` | `12px` | Node label, tooltip body |
| `--nav-font-size-base` | `13px` | Base text |

## Spacing
| Token | Value | Purpose |
|---|---|---|
| `--nav-spacing-1` | `2px` | Spacing scale — padding / gap / margin |
| `--nav-spacing-2` | `4px` | |
| `--nav-spacing-3` | `6px` | |
| `--nav-spacing-4` | `8px` | |
| `--nav-spacing-5` | `10px` | |
| `--nav-spacing-6` | `12px` | |
| `--nav-spacing-7` | `14px` | |

> Off-scale one-off spacings (e.g. 11/24/28/40px) are kept as literals — no token exists for them, per the "no hardcoded px **where a token exists**" criterion.

## Text
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-text` | `#2a2723` | `#f5f2ec` | Default text (on panel bg) |
| `--nav-color-text-secondary` | `#57534e` | `rgba(245,242,236,.7)` | Secondary text |
| `--nav-color-text-muted` | `#8d8881` | `#a8a299` | Muted / label text |

## Accent (Claude clay)
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-accent` | `#d97757` | `#e08a6e` | Clay accent |
| `--nav-color-accent-hover` | `#c8643f` | `#ec9a7e` | Accent hover |
| `--nav-color-accent-soft` | `rgba(217,119,87,.12)` | `rgba(224,138,110,.16)` | Soft accent fill |

## Sticky note (Interactive Map branch labels)
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-sticky-bg` | `#fbcf75` | `#8a6a1a` | Branch label sticky fill |
| `--nav-color-sticky-border` | `#d4a017` | `#b88a20` | Branch label sticky border |

> Deliberately outside the clay family: `--nav-color-accent-soft` is a ~12%
> translucent overlay and renders almost invisible as a label fill. Use these
> for the sticky-note affordance, not the accent tokens.

## Nodes
| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--nav-color-node-fill` | `#ffffff` | `rgba(255,255,255,.05)` | Previous node fill |
| `--nav-color-node-border` | `#d9d4cb` | `rgba(255,255,255,.2)` | Previous node ring |
| `--nav-color-node-number` | `#8d8881` | `#b8b2a9` | Previous node number |
| `--nav-color-node-active` | `#d97757` | `#d97757` | Active node fill |
| `--nav-color-node-active-text` | `#ffffff` | `#ffffff` | Text on accent-filled node/badge |
| `--nav-color-node-branch` | `#d97757` | `#e08a6e` | Branch badge fill |
| `--nav-color-edge` | `#e4e0d9` | `rgba(255,255,255,.16)` | Connector line |
| `--nav-active-glow` | clay drop-shadow | brighter clay glow | Active node glow |

## Animation
| Token | Value | Purpose |
|---|---|---|
| `--nav-duration-fast` | `150ms` | Fast transitions |
| `--nav-duration-base` | `200ms` | Default transitions |
| `--nav-duration-slow` | `300ms` | Slow transitions |
| `--nav-transition` | `var(--nav-duration-base) ease` | Default transition shorthand |

> **Reduced motion:** under `@media (prefers-reduced-motion: reduce)` the duration
> tokens become `0ms` and `--nav-active-glow` is disabled.
