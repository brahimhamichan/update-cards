#!/usr/bin/env node
// Build the offline demo into dist/: one standalone file per example, one stacked document,
// and a gallery (index.html) with width/theme toggles. Preview mode only — nothing here can send.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc } from '../src/html.mjs';
import { loadCard, renderCards } from '../src/index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'dist'));
const files = readdirSync(join(ROOT, 'examples')).filter((f) => f.endsWith('.json')).sort();
const examples = files.map((file) => ({ name: basename(file, '.json'), config: loadCard(join(ROOT, 'examples', file)) }))
  .sort((a, b) => (a.config.index ?? 99) - (b.config.index ?? 99) || a.name.localeCompare(b.name));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'cards'), { recursive: true });

const warnings = [];
const pages = examples.map(({ name, config }) => {
  const result = renderCards(config);
  warnings.push(...result.warnings);
  writeFileSync(join(OUT, 'cards', `${name}.html`), result.html);
  return { name, config, html: result.html };
});

const stacked = renderCards(examples.map((e) => e.config), { title: 'update-cards · all examples' });
writeFileSync(join(OUT, 'all-cards.html'), stacked.html);

const sections = pages
  .map(
    ({ name, config, html }) => `<section class="g-item">
  <p class="g-label"><span>${esc(config.type)}</span><a href="cards/${esc(name)}.html">examples/${esc(name)}.json</a></p>
  <div class="g-frame"><iframe title="${esc(config.title)}" sandbox="allow-scripts allow-same-origin" srcdoc="${esc(html)}"></iframe></div>
</section>`,
  )
  .join('\n');

const gallery = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; base-uri 'none'">
<title>update-cards · gallery</title>
<style>
:root { color-scheme: light dark; --bg: #f4f3ef; --fg: #1b1a18; --muted: #6c6862; --line: #e2dfd9; --chip: #ffffff; }
:root[data-theme="dark"] { color-scheme: dark; --bg: #0c0c0b; --fg: #ecebe7; --muted: #a29f98; --line: #2d2c29; --chip: #181816; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0c0c0b; --fg: #ecebe7; --muted: #a29f98; --line: #2d2c29; --chip: #181816; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
header { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 20px; padding: 14px 20px; background: color-mix(in oklab, var(--bg) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
h1 { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -0.01em; }
.g-note { margin: 0; color: var(--muted); font-size: 12.5px; flex: 1 1 220px; }
.g-controls { display: flex; flex-wrap: wrap; gap: 12px; }
.g-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; background: var(--chip); }
.g-seg button { border: 0; background: none; color: var(--muted); font: inherit; font-size: 12.5px; padding: 6px 11px; cursor: pointer; }
.g-seg button[aria-pressed="true"] { background: var(--fg); color: var(--bg); }
main { display: grid; gap: 28px; padding: 24px 20px 64px; justify-items: center; }
.g-item { width: 100%; max-width: var(--w, 1144px); display: grid; gap: 8px; }
.g-label { margin: 0; display: flex; justify-content: space-between; gap: 12px; font: 500 11.5px/1.4 ui-monospace, Menlo, monospace; color: var(--muted); }
.g-label span { text-transform: uppercase; letter-spacing: 0.06em; }
.g-label a { color: inherit; }
iframe { display: block; width: 100%; height: 160px; border: 0; background: transparent; color-scheme: normal; }
</style>
</head>
<body>
<header>
  <h1>update-cards</h1>
  <p class="g-note">Demo data. Every card here runs in preview mode with sending disabled — submitting shows the payload locally.</p>
  <div class="g-controls">
    <div class="g-seg" role="group" aria-label="Card width" data-control="width">
      <button type="button" data-value="1144px" aria-pressed="true">Fluid</button><button type="button" data-value="728px" aria-pressed="false">728</button><button type="button" data-value="320px" aria-pressed="false">320</button>
    </div>
    <div class="g-seg" role="group" aria-label="Theme" data-control="theme">
      <button type="button" data-value="" aria-pressed="true">System</button><button type="button" data-value="light" aria-pressed="false">Light</button><button type="button" data-value="dark" aria-pressed="false">Dark</button>
    </div>
  </div>
</header>
<main>
${sections}
</main>
<script>
const frames = [...document.querySelectorAll('iframe')];
let theme = '';
function applyTheme(frame) {
  const root = frame.contentDocument?.documentElement;
  if (!root) return;
  if (theme) root.dataset.theme = theme; else delete root.dataset.theme;
}
function fit(frame) {
  const doc = frame.contentDocument;
  if (doc?.body) frame.style.height = Math.ceil(doc.documentElement.getBoundingClientRect().height) + 'px';
}
const watchedDocuments = new WeakSet();
function watchFrame(frame) {
  const doc = frame.contentDocument;
  if (!doc?.documentElement || doc.readyState === 'loading') return;
  applyTheme(frame);
  fit(frame);
  if (watchedDocuments.has(doc)) return;
  watchedDocuments.add(doc);
  new ResizeObserver(() => fit(frame)).observe(doc.documentElement);
}
for (const frame of frames) {
  frame.addEventListener('load', () => watchFrame(frame));
  watchFrame(frame);
}
for (const group of document.querySelectorAll('[data-control]')) {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    if (group.dataset.control === 'width') document.querySelector('main').style.setProperty('--w', button.dataset.value);
    else {
      theme = button.dataset.value;
      if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
      frames.forEach(applyTheme);
    }
  });
}
</script>
</body>
</html>
`;
writeFileSync(join(OUT, 'index.html'), gallery);

for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`);
if (warnings.length) process.exit(1);
process.stdout.write(`Built ${pages.length} cards → ${OUT}\n  index.html (gallery) · all-cards.html (stacked) · cards/*.html\n`);
