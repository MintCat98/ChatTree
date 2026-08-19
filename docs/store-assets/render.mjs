#!/usr/bin/env node
/**
 * Renders every SVG in `docs/store-assets/src/` to a pixel-exact PNG in
 * `docs/store-assets/png/`, using the Chromium browser already installed on
 * the machine. No npm dependencies — this is an authoring tool, not part of
 * the extension build, so it is never imported by webpack or the test suite.
 *
 * Usage:
 *   node docs/store-assets/render.mjs                # render everything
 *   node docs/store-assets/render.mjs promo-tile     # render matching files only
 *   CHROME_PATH="/path/to/chrome" node docs/store-assets/render.mjs
 *
 * The output size is taken from each SVG's own width/height attributes, so the
 * store dimensions (440x280, 1400x560, 1280x800) can never drift from the source.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, 'src');
const OUT = join(here, 'png');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) {
  console.error('No Chromium-based browser found. Set CHROME_PATH to a Chrome/Edge binary.');
  process.exit(1);
}

const filter = process.argv[2];
const svgs = readdirSync(SRC)
  .filter((f) => f.endsWith('.svg'))
  .filter((f) => !filter || f.includes(filter));

if (svgs.length === 0) {
  console.error(`No SVGs matched${filter ? ` "${filter}"` : ''} in ${SRC}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'chattree-store-'));

for (const svg of svgs) {
  const source = readFileSync(join(SRC, svg), 'utf8');
  const width = Number(source.match(/\swidth="(\d+)"/)?.[1]);
  const height = Number(source.match(/\sheight="(\d+)"/)?.[1]);
  if (!width || !height) {
    console.error(`! ${svg} — could not read width/height from the root <svg> element, skipped`);
    continue;
  }

  // Wrap the SVG in a zero-margin page so the screenshot is exactly WxH with no
  // scrollbars or letterboxing. The SVG is self-contained (the logo is inlined
  // as a data URI), so loading it through <img> loses nothing.
  const wrapper = join(work, `${svg}.html`);
  writeFileSync(
    wrapper,
    `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}
img{display:block;width:${width}px;height:${height}px}</style>
<img src="${pathToFileURL(join(SRC, svg)).href}" width="${width}" height="${height}">`,
  );

  const png = join(OUT, svg.replace(/\.svg$/, '.png'));
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=2000',
      `--window-size=${width},${height}`,
      `--screenshot=${png}`,
      pathToFileURL(wrapper).href,
    ],
    { stdio: 'ignore' },
  );
  console.log(`\u2713 ${svg} \u2192 png/${svg.replace(/\.svg$/, '.png')} (${width}\u00d7${height})`);
}

rmSync(work, { recursive: true, force: true });
console.log(`\nRendered ${svgs.length} asset(s) with ${resolve(browser)}`);
