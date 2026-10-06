import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkWebhookUrl, renderCard, renderCards } from '../src/index.mjs';
import { esc, inline, jsonForScript, safeUrl } from '../src/html.mjs';
import { CARDS, ENDPOINT, EXAMPLES, LIVE, TINY_SVG, count, dataBlock, imageChoice, readJson, scriptTags, tempDir, writeImages } from './helpers.mjs';
import { loadCard } from '../src/index.mjs';

const INTERACTIVE = ['yes-no', 'form', 'checklist', 'app-name-choice'];
const READONLY = ['bullet-points', 'big-text', 'explanation-steps', 'explanation-flow', 'explanation-comparison', 'video-walkthrough', 'screenshot-proof'];
const externalRef = (html) => html.match(/\b(?:src|href)\s*=\s*["']https?:[^"']*/gi) ?? [];

test('every card type renders; examples render without warnings', () => {
  for (const [name, card] of Object.entries(CARDS)) assert.ok(renderCard(card).html.startsWith('<!doctype html>'), name);
  for (const file of EXAMPLES) {
    const r = renderCards(loadCard(file));
    assert.deepEqual(r.warnings, [], file);
  }
});

test('script count: read-only none, input cards exactly one data block + one runtime', () => {
  for (const name of READONLY) assert.equal(scriptTags(renderCard(CARDS[name]).html), 0, name);
  const mixed = renderCards([CARDS['bullet-points'], CARDS['yes-no'], CARDS.form]).html;
  assert.equal(scriptTags(mixed), 2);
  assert.equal(count(mixed, 'id="uc-data"'), 1);
  for (const name of INTERACTIVE) assert.equal(scriptTags(renderCard(CARDS[name]).html), 2, name);
  const r = renderCard(CARDS['bullet-points']);
  assert.equal(r.cards[0].interactive, false);
});

test('hostile strings never appear raw and add no tags', () => {
  const hostile = ['<script>alert(1)</script>', '"><img src=x onerror=1>', "'><svg onload=1>", '</script><script>1</script>'];
  for (const h of hostile) {
    const cards = [
      { ...CARDS['yes-no'], title: h, body: h, eyebrow: h, ...(h.length <= 24 && { yesLabel: h, noLabel: h }), noteLabel: h, notePlaceholder: h },
      { ...CARDS.form, id: 'f2', fields: [
        { id: 'a', type: 'text', label: h, help: h, placeholder: h, default: h },
        { id: 'b', type: 'textarea', label: h, default: h },
        { id: 'c', type: 'select', label: h, options: [{ value: h, label: h }, { value: 'z', label: h }], default: h },
        { id: 'd', type: 'checkbox', label: h, options: [{ value: h, label: h }, { value: 'z', label: h }], default: [h] },
      ] },
      { ...CARDS.checklist, id: 'c2', items: [{ id: 'a', label: h, detail: h, href: 'https://ok.test/?q=' + encodeURIComponent(h), linkLabel: h }] },
      { ...CARDS['app-name-choice'], id: 'n2', options: [{ id: 'a', name: h, tagline: h, rationale: h }, { id: 'b', name: h }] },
      { ...CARDS['bullet-points'], id: 'b2', footer: h, items: [{ text: h, detail: h }] },
      { ...CARDS['big-text'], id: 'bt2', label: h, supporting: h, cta: { label: h, href: 'https://ok.test/' } },
      { ...CARDS['explanation-steps'], id: 'x2', steps: [{ title: h, detail: h, more: h }, { title: h }], reveal: { label: h, body: h } },
      { ...CARDS['explanation-comparison'], id: 'x3', columns: [{ title: h, summary: h, points: [h] }, { title: h, points: [{ text: h }] }] },
      imageChoice(['/nonexistent/x.svg', '/nonexistent/y.svg'], 'i2'),
      { ...CARDS['video-walkthrough'], id: 'v2', caption: h, linkLabel: h.slice(0, 40), chapters: [{ time: '0:01', label: h }], facts: [{ label: h.slice(0, 24), value: h }] },
      { ...CARDS['screenshot-proof'], id: 's2', shots: CARDS['screenshot-proof'].shots.map((s) => ({ ...s, alt: h, caption: h, label: h.slice(0, 24), linkLabel: h.slice(0, 40) })) },
    ];
    cards[8].options.forEach((o) => Object.assign(o, { alt: h, caption: h }));
    const { html } = renderCards(cards, LIVE);
    assert.ok(!html.includes(h), `raw hostile string in output: ${h}`);
    const tags = html.replace(/"[^"]*"/g, '""'); // escaped text may sit inside quoted attribute values; check real attributes only
    assert.ok(!/<img[^>]*onerror/i.test(tags) && !html.includes('<svg onload'));
    assert.equal(scriptTags(html), 2, 'only data block + runtime');
  }
});

test('html helpers: escaping, code spans, safeUrl, jsonForScript', () => {
  assert.equal(esc(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(inline('use `a<b` now <b>'), 'use <code>a&lt;b</code> now &lt;b&gt;');
  assert.match(renderCard({ ...CARDS['yes-no'], body: 'run `npm test`' }).html, /<code>npm test<\/code>/);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('/rel'), null);
  assert.equal(safeUrl('https://a.test'), 'https://a.test/');
  const json = jsonForScript({ a: '</script><!-- &  ', b: '>' });
  assert.ok(!/[<>]/.test(json) && !json.includes(' '));
  assert.deepEqual(JSON.parse(json), { a: '</script><!-- &  ', b: '>' });
});

test('requestId pattern is enforced', () => {
  for (const requestId of ['', ' x', 'a b', '<x>', '-x', 'x'.repeat(97), 'a"b']) {
    assert.throws(() => renderCard(CARDS['yes-no'], { webhookUrl: ENDPOINT, requestId }), /requestId/, JSON.stringify(requestId));
  }
  assert.doesNotThrow(() => renderCard(CARDS['yes-no'], { webhookUrl: ENDPOINT, requestId: 'req_a.b:c-1' }));
});

test('output is self-contained and leaks no absolute paths', () => {
  const dir = tempDir();
  const { svg, png } = writeImages(dir);
  const cfg = [
    imageChoice([svg, png]),
    { ...CARDS.checklist, items: [{ id: 'a', label: 'A', href: 'https://allowed.test/doc' }] },
  ];
  const { html, warnings } = renderCards(cfg, LIVE);
  assert.deepEqual(warnings, []);
  assert.ok(!html.includes(dir) && !html.includes('/home/') && !html.includes('/tmp/'));
  assert.equal(count(html, 'src="data:image/svg+xml;base64,'), 1);
  assert.equal(count(html, 'src="data:image/png;base64,'), 1);
  assert.ok(!html.includes('<link') && !/<script[^>]*\ssrc=/i.test(html));
  assert.deepEqual(externalRef(html), ['href="https://allowed.test/doc']);
  const noLinks = renderCards([CARDS['yes-no'], imageChoice([svg, png])], LIVE).html;
  assert.deepEqual(externalRef(noLinks), []);
  assert.ok(noLinks.includes(btoa(TINY_SVG)));
});

test('relative image paths resolve against baseDir and loadCard', () => {
  const dir = tempDir();
  writeImages(dir);
  assert.equal(renderCard(imageChoice(['a.svg', 'b.png']), { baseDir: dir }).warnings.length, 0);
  const file = join(dir, 'card.json');
  writeFileSync(file, JSON.stringify(imageChoice(['a.svg', 'b.png'])));
  const r = renderCards(loadCard(file));
  assert.deepEqual(r.warnings, []);
  assert.ok(!r.html.includes(dir));
});

test('missing, remote, oversized and unsupported images warn with a visible placeholder', () => {
  const dir = tempDir();
  const { svg } = writeImages(dir);
  const big = join(dir, 'big.png');
  writeFileSync(big, Buffer.alloc(400_000));
  writeFileSync(join(dir, 'x.bmp'), 'x');
  const r = renderCard(imageChoice([svg, join(dir, 'gone.svg'), 'https://cdn.test/a.png', big, join(dir, 'x.bmp'), 'data:text/html,hi']));
  assert.equal(r.warnings.length, 5);
  assert.match(r.warnings.join('\n'), /not found/);
  assert.match(r.warnings.join('\n'), /remote/);
  assert.match(r.warnings.join('\n'), /larger/);
  assert.equal(count(r.html, 'data-uc-media data-missing'), 5);
  assert.ok(!r.html.includes('cdn.test') && !r.html.includes('text/html,hi') && !r.html.includes(dir));
  assert.equal(count(r.html, '<img '), 1);
});

test('preview mode: no endpoint, connect-src none', () => {
  const r = renderCard(CARDS['yes-no']);
  assert.equal(r.mode, 'preview');
  assert.equal(dataBlock(r.html).endpoint, null);
  assert.match(r.html, /connect-src &#39;none&#39;/);
  assert.ok(!r.html.includes('hooks.example.test'));
});

test('live mode embeds the endpoint and scopes CSP to its origin', () => {
  const r = renderCard(CARDS['yes-no'], { webhookUrl: 'https://hooks.example.test/x?k=1', requestId: 'req_1' });
  assert.equal(r.mode, 'live');
  assert.deepEqual(dataBlock(r.html), { v: 1, endpoint: 'https://hooks.example.test/x?k=1', requestId: 'req_1' });
  assert.match(r.html, /connect-src https:\/\/hooks\.example\.test;/);
  assert.match(r.html, /form-action &#39;none&#39;/);
});

test('live mode requires requestId; preview gets a default', () => {
  assert.throws(() => renderCard(CARDS['yes-no'], { webhookUrl: ENDPOINT }), /requestId is required/);
  assert.equal(renderCard(CARDS['yes-no']).requestId, 'preview');
});

test('webhook URL validation', () => {
  for (const bad of ['http://hooks.example.test/x', 'https://user:pw@hooks.example.test/x', 'ftp://x.test', 'not a url', 'javascript:alert(1)']) {
    assert.throws(() => checkWebhookUrl(bad), /Webhook URL/, bad);
    assert.throws(() => renderCard(CARDS['yes-no'], { webhookUrl: bad, requestId: 'r' }), /Webhook URL/, bad);
  }
  for (const ok of ['http://localhost:8787/x', 'http://127.0.0.1/x', 'https://a.test/x']) assert.doesNotThrow(() => checkWebhookUrl(ok), ok);
});

test('duplicate card ids and empty input are rejected; invalid cards name the card', () => {
  assert.throws(() => renderCards([CARDS['yes-no'], { ...CARDS['big-text'], id: 'yn' }]), /unique.*"yn"/);
  assert.throws(() => renderCards([]), /at least one/);
  assert.throws(() => renderCards([CARDS['yes-no'], { ...CARDS.form, fields: [] }]), /card #2 \(fm\)[\s\S]*fields/);
});

test('oversized documents produce a size warning', () => {
  const r = renderCard({ ...CARDS['yes-no'] }, {});
  assert.ok(r.html.length < 512_000);
  const dir = tempDir();
  const files = [];
  for (let i = 0; i < 3; i++) { const f = join(dir, `i${i}.png`); writeFileSync(f, Buffer.alloc(300_000)); files.push(f); }
  const big = renderCard(imageChoice(files));
  assert.match(big.warnings.join('\n'), /characters; T3 html_render accepts at most/);
});

test('examples round-trip through JSON data without mutation', () => {
  for (const file of EXAMPLES) {
    const config = readJson(file);
    const copy = structuredClone(config);
    renderCard(config, { baseDir: tempDir() });
    assert.deepEqual(config, copy, file);
  }
});

test('generated DOM ids stay unique even when card and field ids look alike', () => {
  const field = (id) => ({ id, type: 'text', label: id });
  const { html } = renderCards([
    { type: 'form', id: 'a', title: 'A', allowNote: true, fields: [field('b-c'), field('title'), field('item-0')] },
    { type: 'form', id: 'a-b', title: 'B', fields: [field('c')] },
    { type: 'checklist', id: 'a-title', title: 'C', items: [{ id: 'x', label: 'X' }] },
  ]);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

test('video-walkthrough: native player, nothing autoplays or preloads, exact media-src origin', () => {
  const dir = tempDir();
  const { svg } = writeImages(dir);
  const { html, warnings } = renderCard({ ...CARDS['video-walkthrough'], poster: svg }, {});
  assert.deepEqual(warnings, []);
  const video = html.match(/<video[^>]*>/)[0];
  assert.match(video, /\scontrols\s/);
  assert.match(video, /preload="none"/);
  assert.match(video, /poster="data:image\/svg\+xml;base64,/);
  assert.ok(!/autoplay|muted|loop/.test(video), video);
  assert.match(html, /<source src="https:\/\/media\.example\.test\/clips\/demo\.mp4" type="video\/mp4">/);
  assert.match(html, /media-src https:\/\/media\.example\.test;/);
  assert.match(html, /<time class="uc-chapter-time">1:05<\/time>/);
  assert.match(html, /<a class="uc-link" href="https:\/\/media\.example\.test\/clips\/demo\.mp4"[^>]*>Open video/);
  assert.match(html, /<dt>Viewport<\/dt><dd>1144px<\/dd>/);
  assert.equal(scriptTags(html), 0);
  assert.ok(!html.includes(dir));
  // Two videos on different origins → both origins, nothing broader.
  const two = renderCards([CARDS['video-walkthrough'], { ...CARDS['video-walkthrough'], id: 'v2', src: 'https://cdn.other.test/a.webm', href: 'https://example.test/pr/1' }]).html;
  assert.match(two, /media-src https:\/\/media\.example\.test https:\/\/cdn\.other\.test;/);
  assert.match(two, /type="video\/webm"/);
  assert.match(two, /href="https:\/\/example\.test\/pr\/1"/);
});

test('media-src defaults to none; small local videos inline as data:, large or missing ones show a fallback', () => {
  assert.match(renderCard(CARDS['screenshot-proof']).html, /media-src &#39;none&#39;;/);
  const dir = tempDir();
  writeFileSync(join(dir, 'clip.mp4'), Buffer.alloc(2_000));
  writeFileSync(join(dir, 'big.mp4'), Buffer.alloc(400_000));
  const local = renderCard({ ...CARDS['video-walkthrough'], src: 'clip.mp4' }, { baseDir: dir });
  assert.deepEqual(local.warnings, []);
  assert.match(local.html, /<source src="data:video\/mp4;base64,/);
  assert.match(local.html, /media-src data:;/);
  assert.ok(!local.html.includes('Open video'), 'inlined video has no link unless href is given');
  for (const src of ['big.mp4', 'gone.mp4', 'clip.mkv']) {
    const r = renderCard({ ...CARDS['video-walkthrough'], src }, { baseDir: dir });
    assert.equal(r.warnings.length, 1, src);
    assert.ok(!r.html.includes('<video'), src);
    assert.match(r.html, /class="uc-player" data-aspect="16:9" data-missing>/);
    assert.match(r.html, /Video unavailable/);
    assert.match(r.html, /media-src &#39;none&#39;;/);
  }
  const noPoster = renderCard({ ...CARDS['video-walkthrough'], poster: join(dir, 'gone.png') });
  assert.match(noPoster.warnings[0], /vw\/poster: image file not found/);
  assert.match(noPoster.html, /Poster image unavailable/);
  assert.ok(!/<video[^>]*poster=/.test(noPoster.html));
});

test('screenshot-proof: inlined figures, before/after labels, original links, missing fallback', () => {
  const dir = tempDir();
  const { svg, png } = writeImages(dir);
  const r = renderCard({ ...CARDS['screenshot-proof'], shots: [{ src: svg, alt: 'A' }, { src: png, alt: 'B', caption: 'After fix', href: 'https://example.test/full.png' }] });
  assert.deepEqual(r.warnings, []);
  assert.equal(count(r.html, '<figure class="uc-shot">'), 2);
  assert.match(r.html, /data-layout="before-after"/);
  assert.match(r.html, /uc-shot-label">Before<[\s\S]*uc-shot-label">After</);
  assert.match(r.html, /<img src="data:image\/png;base64,[^"]+" alt="B"/);
  assert.match(r.html, /href="https:\/\/example\.test\/full\.png"[^>]*>Open original/);
  assert.ok(!r.html.includes(dir));
  assert.throws(() => renderCard({ ...CARDS['screenshot-proof'], shots: [{ src: 'https://cdn.test/x.png', alt: 'R' }, { src: svg, alt: 'S' }] }), /local image path/);
});

test('proof cards resolve relative assets via loadCard and baseDir', () => {
  const dir = tempDir();
  writeImages(dir);
  writeFileSync(join(dir, 'clip.webm'), Buffer.alloc(1_000));
  const proof = { ...CARDS['screenshot-proof'], shots: [{ src: 'a.svg', alt: 'A' }, { src: 'b.png', alt: 'B' }] };
  const video = { ...CARDS['video-walkthrough'], src: 'clip.webm', poster: 'a.svg' };
  for (const [name, card] of [['proof.json', proof], ['video.json', video]]) writeFileSync(join(dir, name), JSON.stringify(card));
  const loaded = renderCards([loadCard(join(dir, 'proof.json')), loadCard(join(dir, 'video.json'))], { baseDir: '/nonexistent' });
  assert.deepEqual(loaded.warnings, []);
  assert.match(loaded.html, /<source src="data:video\/webm;base64,/);
  assert.ok(!loaded.html.includes(dir));
  assert.deepEqual(renderCards([proof, video], { baseDir: dir }).warnings, []);
  const missing = renderCard({ ...proof, layout: 'gallery', shots: [{ src: 'gone.png', alt: 'Gone' }] }, { baseDir: dir });
  assert.match(missing.warnings[0], /sp\/shots\[0\]: image file not found/);
  assert.match(missing.html, /uc-shot-media" data-missing>/);
  assert.match(missing.html, /Screenshot unavailable/);
});
