# Store Assets

Listing artwork for the **Microsoft Edge Add-ons** and **Chrome Web Store** pages
(issue [#144](https://github.com/MintCat98/ChatTree/issues/144)).

> **Status: placeholders.** Every PNG in `png/` is generated artwork that carries a
> visible `PLACEHOLDER` badge. They exist so the listing layout, dimensions and copy
> can be reviewed now; the real product captures land in a follow-up. **Do not upload
> anything from this folder to a store until the checklist at the bottom is done.**

---

## 1. What the stores ask for

| Asset                        | Size (px)              | Store                | This folder                                      |
| ---------------------------- | ---------------------- | -------------------- | ------------------------------------------------ |
| Small promotional tile       | 440 × 280              | Edge + Chrome        | `png/promo-tile-440x280.png`                     |
| Large promotional tile       | 1400 × 560             | Edge + Chrome        | `png/promo-marquee-1400x560.png`                 |
| Screenshots (1–10)           | 1280 × 800             | Edge + Chrome        | `png/screenshot-0*.png` (4 placeholders)         |
| Store logo                   | 300 × 300              | Edge                 | — not in scope for #144                          |
| Extension icon               | 16 / 48 / 128          | manifest             | already in `src/assets/icons/`                   |

Format is PNG, RGB, no transparency in the promotional tiles. Edge also accepts
640 × 400 screenshots, but 1280 × 800 is what #144 asks for and what renders best
on the store page — keep every screenshot at 1280 × 800 so the strip is uniform.

Store requirements change; re-check them in Partner Center / the Developer
Dashboard right before a submission rather than trusting this table.

---

## 2. Folder layout

```
docs/store-assets/
├── README.md      ← this file
├── render.mjs     ← SVG → PNG exporter (uses the local Chrome/Edge, no npm deps)
├── src/           ← editable sources, one SVG per asset (the source of truth)
└── png/           ← exported PNGs at exact store dimensions (upload these)
```

`src/*.svg` uses the panel's own design tokens so the artwork cannot drift from
the product: cream `#f5f2ec`, ink `#2a2723`, clay accent `#d97757`, hairline
border `#e9e5df`, node ring `#d9d4cb` (see `src/content/panel/styles/panel.css`).
The logo is embedded as a data URI, so each SVG is self-contained and opens
anywhere — browser, Figma, Illustrator, Inkscape.

---

## 3. Editing and exporting

Edit the SVG in `src/`, then re-export:

```bash
node docs/store-assets/render.mjs                 # all assets
node docs/store-assets/render.mjs promo-tile      # only files matching "promo-tile"
CHROME_PATH="/path/to/chrome" node docs/store-assets/render.mjs
```

The exporter finds an installed Chrome or Edge, renders each SVG headless, and
writes `png/<same-name>.png`. Output size comes from the SVG's own `width`/`height`,
so the store dimensions can never drift from the source. It is an authoring tool —
webpack, Jest and the extension build never touch it.

Prefer a design tool? Import the SVG, edit, and export PNG at **1×** with the
same file name. Either path is fine as long as `src/` and `png/` stay in sync.

---

## 4. Replacing the placeholders

**Promotional tiles** stay illustrated — swap the mock panel for polished artwork,
keep the wordmark and tagline, then delete the `<g id="placeholder-badge">` group
(it is marked with a comment in every SVG).

**Screenshots** must become real captures. Each placeholder states, in its caption
band, what its final capture has to show:

| File                                       | Must show                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `screenshot-01-tree-map-1280x800`          | Panel over a real claude.ai session, every turn as a node, latest highlighted |
| `screenshot-02-hover-preview-1280x800`     | Hover tooltip with the full prompt, and the chat scrolled to the clicked turn |
| `screenshot-03-search-bookmark-tag-1280x800` | A real query with matching turns, one bookmarked node, one tagged node |
| `screenshot-04-branch-settings-1280x800`   | A session with a real branch (e.g. `2/3`) and the settings panel open   |

Capture guidance:

- Browser window at **1280 × 800**, device pixel ratio 1, browser zoom 100%.
- Light theme, so the strip matches the promotional tiles.
- Use a throwaway chat session — **no personal data**: no real names, emails,
  account avatars, workspace names, or private prompt text. Blur nothing; write
  the demo conversation to be screenshot-safe from the start.
- Keep the caption band and its wording if the exported screenshot still needs a
  label; otherwise export the capture full-bleed at 1280 × 800.

---

## 5. Pre-submission checklist

- [ ] Real captures replace all four screenshot placeholders
- [ ] `<g id="placeholder-badge">` deleted from every SVG that ships
- [ ] Every PNG re-exported and confirmed at its exact size (`render.mjs` prints it)
- [ ] No personal or account data visible in any capture
- [ ] Extension version in the captures matches the release being submitted
- [ ] Tiles read correctly at small sizes (the 440 × 280 tile is shown much smaller in listings)
- [ ] Dimensions re-checked against current Partner Center / Developer Dashboard requirements
