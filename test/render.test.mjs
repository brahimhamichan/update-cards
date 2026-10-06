import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkWebhookUrl, renderCard, renderCards } from '../src/index.mjs';
import { esc, inline, jsonForScript, safeUrl } from '../src/html.mjs';
import { CARDS, ENDPOINT, EXAMPLES, LIVE, TINY_SVG, count, dataBlock, imageChoice, readJson, scriptTags, tempDir, writeImages } from './helpers.mjs';
import { loadCard } from '../src/index.mjs';

const INTERACTIVE = ['yes-no', 'form', 'checklist', 'app-name-choice'];
const READONLY = ['bullet-points', 'big-text', 'explanation-steps', 'explanation-flow', 'explanation-comparison'];
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
    ];
    cards[8].options.forEach((o) => Object.assign(o, { alt: h, caption: h }));
    const { html } = renderCards(cards, LIVE);
    assert.ok(!html.includes(h), `raw hostile string in output: ${h}`);
    assert.ok(!/<img[^>]*onerror/i.test(html) && !html.includes('<svg onload'));
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
