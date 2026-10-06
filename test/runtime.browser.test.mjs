// Real-browser test of the inlined runtime using a headless Chromium shell (no dependencies, no servers).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { before, describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { renderCards } from '../src/index.mjs';
import { CARDS, ENDPOINT, LIVE, imageChoice, tempDir, writeImages } from './helpers.mjs';

function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const base = join(homedir(), '.cache/ms-playwright');
  if (!existsSync(base)) return null;
  const dirs = readdirSync(base).filter((d) => d.startsWith('chromium_headless_shell-')).sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const d of dirs) {
    const bin = join(base, d, 'chrome-headless-shell-linux64/chrome-headless-shell');
    if (existsSync(bin)) return bin;
  }
  return null;
}
const CHROME = findChrome();
const dir = tempDir('uc-browser-');
let n = 0;

/**
 * Render cards, append a harness after the runtime, run it in Chromium, and return the JSON the harness wrote.
 * `script` runs in the page with helpers: fetchCalls, consoleCalls, results, sleep, $, $$, card(id), press(el, key).
 */
function runPage(cards, options, script) {
  const { html } = renderCards(cards, options);
  const harness = `<script>(async () => {
  const fetchCalls = [], consoleCalls = [], results = {};
  window.__fetchMode = 'ok';
  window.fetch = (url, opts) => { fetchCalls.push({ url, opts }); return window.__fetchMode === 'ok' ? Promise.resolve({}) : Promise.reject(new TypeError('boom')); };
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = (...a) => consoleCalls.push(a.map(String).join(' '));
  const sleep = (ms = 30) => new Promise((r) => setTimeout(r, ms));
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const card = (id) => $('[data-uc-card="' + id + '"]');
  const press = (el, key, init = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  const body = (i = 0) => JSON.parse(fetchCalls[i].opts.body);
  try {
    ${script}
    results.consoleCalls = consoleCalls;
  } catch (e) { results.harnessError = String(e && e.stack || e); }
  const pre = document.createElement('pre'); pre.id = 'results'; pre.textContent = JSON.stringify(results);
  document.body.appendChild(pre);
})();</script>`;
  const file = join(dir, `page-${n++}.html`);
  writeFileSync(file, html.replace('</body>', () => `${harness}</body>`));
  const dom = execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=5000', '--dump-dom', pathToFileURL(resolve(file)).href], { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'ignore'] });
  const match = dom.match(/<pre id="results">([\s\S]*?)<\/pre>/);
  assert.ok(match, 'harness did not produce results');
  const text = match[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const results = JSON.parse(text);
  assert.equal(results.harnessError, undefined, results.harnessError);
  return results;
}

describe('runtime in headless Chromium', { skip: CHROME ? false : 'no headless chromium' }, () => {
  before(() => assert.ok(CHROME));

  test('yes-no: one POST, sent state, locked controls, duplicate click ignored', () => {
    const r = runPage([CARDS['yes-no']], LIVE, `
      const c = card('yn');
      results.initial = c.dataset.ucState;
      $('[data-uc-value="yes"]', c).click();
      await sleep();
      results.state = c.dataset.ucState;
      results.disabled = $$('button[data-uc-action]', c).map((b) => b.disabled);
      results.calls1 = fetchCalls.length;
      $('[data-uc-value="no"]', c).click();
      $('[data-uc-value="yes"]', c).click();
      await sleep();
      results.calls2 = fetchCalls.length;
      results.first = { url: fetchCalls[0].url, opts: { ...fetchCalls[0].opts, signal: !!fetchCalls[0].opts.signal }, body: body() };
    `);
    assert.equal(r.initial, 'idle');
    assert.equal(r.state, 'sent');
    assert.deepEqual(r.disabled, [true, true]);
    assert.equal(r.calls1, 1);
    assert.equal(r.calls2, 1, 'later clicks send nothing');
    assert.equal(r.first.url, ENDPOINT);
    assert.equal(r.first.opts.method, 'POST');
    assert.equal(r.first.opts.mode, 'no-cors');
    assert.equal(r.first.opts.credentials, 'omit');
    assert.equal(r.first.opts.signal, true);
    const b = r.first.body;
    assert.deepEqual({ ...b, submittedAt: undefined }, { schema: 'update-cards.response', version: 1, requestId: 'req_test', cardId: 'yn', type: 'yes-no', action: 'answer', values: { answer: 'yes' }, attempt: 1, submittedAt: undefined });
    assert.ok(!Number.isNaN(Date.parse(b.submittedAt)));
  });

  test('yes-no with a note sends the trimmed note', () => {
    const r = runPage([CARDS['yes-no']], LIVE, `
      const c = card('yn');
      $('textarea[name="note"]', c).value = '  careful  ';
      $('[data-uc-value="no"]', c).click();
      await sleep();
      results.values = body().values;
    `);
    assert.deepEqual(r.values, { note: 'careful', answer: 'no' });
  });

  test('form: required blocks send; filled sends typed values; Enter rules', () => {
    const r = runPage([CARDS.form], LIVE, `
      const c = card('fm');
      const submit = () => $('[data-uc-primary]', c).click();
      submit();
      await sleep();
      results.blockedCalls = fetchCalls.length;
      results.blockedState = c.dataset.ucState;
      const name = $('input[name="name"]', c);
      name.value = '  Ada ';
      $('textarea[name="bio"]', c).value = 'line1\\nline2';
      press($('textarea[name="bio"]', c), 'Enter');
      await sleep();
      results.afterTextareaEnter = fetchCalls.length;
      $('select[name="size"]', c).value = 's';
      $('input[name="color"][value="b"]', c).checked = true;
      $('input[name="tags"][value="b"]', c).checked = true;
      $('input[name="agree"]', c).checked = true;
      press(name, 'Enter');
      await sleep();
      results.afterTextEnter = fetchCalls.length;
      results.state = c.dataset.ucState;
      results.values = body().values;
      results.action = body().action;
    `);
    assert.equal(r.blockedCalls, 0);
    assert.equal(r.blockedState, 'idle');
    assert.equal(r.afterTextareaEnter, 0, 'Enter in a textarea only adds a newline');
    assert.equal(r.afterTextEnter, 1);
    assert.equal(r.state, 'sent');
    assert.equal(r.action, 'submit');
    assert.deepEqual(r.values, { name: 'Ada', bio: 'line1\nline2', size: 's', color: 'b', tags: ['a', 'b'], agree: true });
  });

  test('form: unchecked defaults give empty array / null / false', () => {
    const r = runPage([CARDS.form], LIVE, `
      const c = card('fm');
      $('input[name="name"]', c).value = 'x';
      $$('input[name="tags"]', c).forEach((b) => (b.checked = false));
      $('[data-uc-primary]', c).click();
      await sleep();
      results.values = body().values;
    `);
    assert.deepEqual(r.values, { name: 'x', bio: 'hi', size: 'l', color: null, tags: [], agree: false });
  });

  test('checklist sends checked and unchecked ids and updates progress', () => {
    const r = runPage([CARDS.checklist], LIVE, `
      const c = card('cl');
      results.before = $('[data-uc-progress-label]', c).textContent;
      $('input[value="b"]', c).click();
      results.after = $('[data-uc-progress-label]', c).textContent;
      $('input[value="a"]', c).click();
      $('[data-uc-primary]', c).click();
      await sleep();
      results.values = body().values;
    `);
    assert.equal(r.before, '1 of 2 done');
    assert.equal(r.after, 'All 2 done');
    assert.deepEqual(r.values, { checked: ['b'], unchecked: ['a'] });
  });

  test('checklist minChecked blocks send until satisfied', () => {
    const cl = { ...CARDS.checklist, minChecked: 2 };
    const r = runPage([cl], LIVE, `
      const c = card('cl');
      $('input[value="a"]', c).click();
      $('[data-uc-primary]', c).click();
      await sleep();
      results.blocked = fetchCalls.length;
      $('input[value="a"]', c).click();
      $('input[value="b"]', c).click();
      $('[data-uc-primary]', c).click();
      await sleep();
      results.sent = fetchCalls.length;
    `);
    assert.equal(r.blocked, 0);
    assert.equal(r.sent, 1);
  });

  test('image-choice and app-name-choice send { choice }; choice is required', () => {
    const { svg, png } = writeImages(dir);
    const r = runPage([imageChoice([svg, png]), CARDS['app-name-choice']], LIVE, `
      const ic = card('ic'), an = card('an');
      $('[data-uc-primary]', ic).click();
      await sleep();
      results.blocked = fetchCalls.length;
      $('input[value="o1"]', ic).click();
      $('[data-uc-primary]', ic).click();
      $('input[value="two"]', an).click();
      press($('input[value="two"]', an), 'Enter');
      await sleep();
      results.bodies = fetchCalls.map((_, i) => ({ id: body(i).cardId, type: body(i).type, values: body(i).values }));
      results.states = [ic.dataset.ucState, an.dataset.ucState];
    `);
    assert.equal(r.blocked, 0);
    assert.deepEqual(r.bodies, [
      { id: 'ic', type: 'image-choice', values: { choice: 'o1' } },
      { id: 'an', type: 'app-name-choice', values: { choice: 'two' } },
    ]);
    assert.deepEqual(r.states, ['sent', 'sent']);
  });

  test('failed send shows error, re-enables controls, retry is attempt 2', () => {
    const r = runPage([CARDS['yes-no']], LIVE, `
      const c = card('yn');
      window.__fetchMode = 'fail';
      $('[data-uc-value="yes"]', c).click();
      await sleep();
      results.state = c.dataset.ucState;
      results.disabled = $$('button[data-uc-action]', c).map((b) => b.disabled);
      results.status = $('[data-uc-status]', c).textContent;
      window.__fetchMode = 'ok';
      $('[data-uc-value="yes"]', c).click();
      await sleep();
      results.state2 = c.dataset.ucState;
      results.attempts = fetchCalls.map((_, i) => body(i).attempt);
    `);
    assert.equal(r.state, 'error');
    assert.deepEqual(r.disabled, [false, false]);
    assert.match(r.status, /Nothing was confirmed/);
    assert.equal(r.state2, 'sent');
    assert.deepEqual(r.attempts, [1, 2]);
  });

  test('preview mode never fetches: demo state, payload preview, reset', () => {
    const r = runPage([CARDS['yes-no']], {}, `
      const c = card('yn');
      $('[data-uc-value="yes"]', c).click();
      await sleep();
      results.state = c.dataset.ucState;
      results.calls = fetchCalls.length;
      const pre = $('[data-uc-payload] pre', c);
      results.payload = pre && JSON.parse(pre.textContent);
      const reset = $('[data-uc-reset]', c);
      results.resetVisible = !reset.hidden;
      results.disabled = $$('button[data-uc-action]', c).map((b) => b.disabled);
      reset.click();
      await sleep();
      results.state2 = c.dataset.ucState;
      results.disabled2 = $$('button[data-uc-action]', c).map((b) => b.disabled);
      results.payloadHidden = $('[data-uc-payload]', c).hidden;
    `);
    assert.equal(r.state, 'demo');
    assert.equal(r.calls, 0);
    assert.equal(r.payload.values.answer, 'yes');
    assert.equal(r.payload.requestId, 'preview');
    assert.equal(r.resetVisible, true);
    assert.deepEqual(r.disabled, [true, true]);
    assert.equal(r.state2, 'idle');
    assert.deepEqual(r.disabled2, [false, false]);
    assert.equal(r.payloadHidden, true);
  });

  test('form field named "checked" submits (no checklist-only assumptions)', () => {
    const form = { type: 'form', id: 'fx', title: 'F', fields: [{ id: 'checked', type: 'checkbox', label: 'Pick', required: true, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }] };
    const r = runPage([form], LIVE, `
      const c = card('fx');
      $('input[value="b"]', c).click();
      $('[data-uc-primary]', c).click();
      await sleep();
      results.state = c.dataset.ucState;
      results.values = fetchCalls.length ? body().values : null;
    `);
    assert.equal(r.state, 'sent');
    assert.deepEqual(r.values, { checked: ['b'] });
  });

  test('missing image is marked in the browser; endpoint never reaches console', () => {
    const r = runPage([imageChoice(['/nonexistent/a.svg', '/nonexistent/b.svg']), CARDS['yes-no']], LIVE, `
      await sleep(100);
      results.missing = $$('[data-uc-media][data-missing]').length;
      window.__fetchMode = 'fail';
      $('[data-uc-value="yes"]', card('yn')).click();
      await sleep();
    `);
    assert.equal(r.missing, 2);
    assert.ok(!JSON.stringify(r.consoleCalls).includes('hooks.example.test'), 'endpoint leaked to console');
  });
  test('proof cards: screenshots decode, missing ones show a fallback, the video waits for the user', () => {
    const shots = [CARDS['screenshot-proof'].shots[0], { src: '/nonexistent/gone.png', alt: 'Gone' }];
    const r = runPage([CARDS['video-walkthrough'], { ...CARDS['screenshot-proof'], layout: 'gallery', shots }], {}, `
      await sleep(100);
      const v = $('video');
      results.video = { paused: v.paused, autoplay: v.autoplay, preload: v.preload, controls: v.controls, readyState: v.readyState };
      results.decoded = $$('.uc-shot img').map((img) => img.complete && img.naturalWidth > 0);
      results.fallback = getComputedStyle($('.uc-shot-media[data-missing] .uc-missing')).display;
      results.scripts = $$('script').length;
      results.dataBlock = !!$('#uc-data');
      results.buttons = $$('.uc-shot [data-uc-zoom]').length;
    `);
    assert.deepEqual(r.video, { paused: true, autoplay: false, preload: 'none', controls: true, readyState: 0 });
    assert.deepEqual(r.decoded, [true]);
    assert.equal(r.fallback, 'flex');
    assert.equal(r.scripts, 2, 'the test harness plus the media runtime; no response runtime');
    assert.equal(r.dataBlock, false);
    assert.equal(r.buttons, 1, 'the missing screenshot is not a preview button');
  });

  test('lightbox: per-card gallery, navigation, zoom, close paths, focus restore; previews never pick or send', () => {
    const { svg, png } = writeImages(dir);
    const shots = { ...CARDS['screenshot-proof'], layout: 'gallery', shots: [{ src: png, alt: 'Shot A', label: 'Desktop', caption: 'Wide `view`', href: 'https://example.test/a.png' }, { src: svg, alt: 'Shot B' }] };
    const r = runPage([imageChoice([svg, png, svg]), shots], LIVE, `
      const ic = card('ic'), box = $('[data-uc-lightbox]'), stage = $('[data-uc-lb-stage]'), view = $('[data-uc-lb-img]');
      const ctl = (n) => $('[data-uc-lb="' + n + '"]');
      const state = () => ({ open: box.open, count: $('[data-uc-lb-count]').textContent, caption: $('[data-uc-lb-caption]').textContent, alt: view.alt, prev: ctl('prev').disabled, next: ctl('next').disabled });
      const thumbs = $$('[data-uc-zoom]', ic);
      results.kinds = thumbs.map((b) => b.tagName + ':' + b.type + ':' + !!b.closest('label'));
      thumbs[1].click();
      await sleep();
      results.opened = { ...state(), src: view.src === $('img', thumbs[1]).src, title: $('[data-uc-lb-title]').textContent, focus: document.activeElement === ctl('close') };
      press(box, 'ArrowRight');
      results.right = state();
      ctl('prev').click(); ctl('prev').click();
      results.start = state();
      ctl('zoom').click();
      await sleep();
      results.zoom = { mode: stage.dataset.zoom, pressed: ctl('zoom').getAttribute('aria-pressed'), wider: view.getBoundingClientRect().width > stage.clientWidth * 0.9 };
      view.click();
      results.unzoom = stage.dataset.zoom;
      press(box, 'Escape');
      await sleep();
      results.escape = { open: box.open, focus: document.activeElement === thumbs[1]};
      thumbs[0].click(); stage.click(); await sleep();
      results.backdrop = { open: box.open, focus: document.activeElement === thumbs[0] };
      thumbs[2].click(); ctl('close').click(); await sleep();
      results.closeBtn = { open: box.open, focus: document.activeElement === thumbs[2] };
      results.untouched = { checked: $$('input[name="choice"]:checked', ic).length, calls: fetchCalls.length, state: ic.dataset.ucState };
      // Second card: its own gallery, label + caption, original link.
      const shotThumbs = $$('[data-uc-zoom]', card('sp') || $$('.uc-card')[1]);
      shotThumbs[0].click();
      results.shot = { ...state(), original: $('[data-uc-lb-original]').href, originalHidden: $('[data-uc-lb-original]').hidden };
      box.close();
      // Explicit pick still works and sends exactly once; previews stay usable after sending.
      $('label[for="ic~opt~2"]', ic).click();
      $('[data-uc-primary]', ic).click();
      await sleep();
      results.sent = { calls: fetchCalls.length, values: body().values, state: ic.dataset.ucState, thumbsEnabled: thumbs.every((b) => !b.disabled) };
      thumbs[0].click();
      results.afterSend = { open: box.open, radiosDisabled: $$('input[name="choice"]', ic).every((i) => i.disabled) };
      box.close();
    `);
    assert.deepEqual(r.kinds, ['BUTTON:button:false', 'BUTTON:button:false', 'BUTTON:button:false']);
    assert.deepEqual(r.opened, { open: true, count: '2 / 3', caption: 'Cap 1', alt: 'Option 1', prev: false, next: false, src: true, title: 'Pick', focus: true });
    assert.equal(r.right.count, '3 / 3');
    assert.equal(r.right.next, true, 'next disabled at the end');
    assert.equal(r.start.count, '1 / 3');
    assert.equal(r.start.prev, true);
    assert.deepEqual(r.zoom, { mode: 'actual', pressed: 'true', wider: true });
    assert.equal(r.unzoom, 'fit');
    assert.deepEqual(r.escape, { open: false, focus: true });
    assert.deepEqual(r.backdrop, { open: false, focus: true });
    assert.deepEqual(r.closeBtn, { open: false, focus: true });
    assert.deepEqual(r.untouched, { checked: 0, calls: 0, state: 'idle' }, 'previewing never selects or sends');
    assert.equal(r.shot.count, '1 / 2', 'gallery is scoped to the clicked card');
    assert.equal(r.shot.caption, 'Desktop · Wide view');
    assert.equal(r.shot.original, 'https://example.test/a.png');
    assert.equal(r.shot.originalHidden, false);
    assert.deepEqual(r.sent, { calls: 1, values: { choice: 'o2' }, state: 'sent', thumbsEnabled: true });
    assert.deepEqual(r.afterSend, { open: true, radiosDisabled: true }, 'previews stay usable after sending; choices stay locked');
  });

  test('lightbox full screen: requested on the viewer when allowed, honest in-frame note when blocked', () => {
    const { svg } = writeImages(dir);
    const r = runPage([{ ...CARDS['screenshot-proof'], layout: 'gallery', shots: [{ src: svg, alt: 'A' }] }], {}, `
      const box = $('[data-uc-lightbox]'), note = $('[data-uc-lb-note]');
      const calls = [];
      Element.prototype.requestFullscreen = function () { calls.push(this.dataset.ucLbFrame !== undefined); return Promise.resolve(); };
      $('[data-uc-zoom]').click();
      $('[data-uc-lb="fullscreen"]').click();
      await sleep();
      results.allowed = { calls, note: note.textContent, nav: $('[data-uc-lb="next"]').hidden };
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true });
      $('[data-uc-lb="fullscreen"]').click();
      await sleep();
      results.blocked = { calls: calls.length, note: note.textContent, open: box.open };
    `);
    assert.deepEqual(r.allowed, { calls: [true], note: '', nav: true });
    assert.equal(r.blocked.calls, 1, 'no request when the frame forbids full screen');
    assert.match(r.blocked.note, /isn’t allowed where this card is shown/);
    assert.equal(r.blocked.open, true);
  });

  test('video full screen: native request on the same element; blocked → in-frame player with Escape, close, focus restore', () => {
    const r = runPage([CARDS['video-walkthrough']], {}, `
      const video = $('video'), button = $('[data-uc-fullscreen]'), theater = $('[data-uc-theater]');
      const moved = [];
      new MutationObserver((list) => list.forEach((m) => [...m.removedNodes].forEach((n) => n.nodeType === 1 && moved.push(n.nodeName)))).observe(document.body, { childList: true, subtree: true });
      const calls = [];
      let mode = 'ok';
      HTMLVideoElement.prototype.requestFullscreen = function () { calls.push(this === video); return mode === 'ok' ? Promise.resolve() : Promise.reject(new TypeError('Permissions check failed')); };
      button.click();
      await sleep();
      results.native = { calls: [...calls], theater: theater.matches(':popover-open') };
      mode = 'deny';
      button.click();
      await sleep();
      results.denied = {
        calls: calls.length, open: theater.matches(':popover-open'), role: theater.getAttribute('role'), modal: theater.getAttribute('aria-modal'),
        note: $('[data-uc-theater-note]').textContent, focus: document.activeElement === $('[data-uc-theater-close]'),
        buttonInert: !!button.closest('[inert]'), videoInert: !!video.closest('[inert]'), link: $('.uc-theater-bar a').href,
        height: Math.round(theater.getBoundingClientRect().height) >= Math.min(innerHeight, 320),
      };
      press($('[data-uc-theater-close]'), 'Escape');
      await sleep();
      results.closed = { open: theater.matches(':popover-open'), focus: document.activeElement === button, inert: $$('[inert]').length, role: theater.getAttribute('role') };
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false, configurable: true });
      button.click();
      await sleep();
      results.blocked = { calls: calls.length, open: theater.matches(':popover-open') };
      $('[data-uc-theater-close]').click();
      await sleep();
      results.final = { open: theater.matches(':popover-open'), focus: document.activeElement === button, videos: $$('video').length, same: $('video') === video, connected: video.isConnected, paused: video.paused, autoplay: video.autoplay, moved };
    `);
    assert.deepEqual(r.native, { calls: [true], theater: false });
    assert.equal(r.denied.calls, 2);
    assert.equal(r.denied.open, true);
    assert.equal(r.denied.role, 'dialog');
    assert.equal(r.denied.modal, 'true');
    assert.match(r.denied.note, /Full screen isn’t allowed/);
    assert.equal(r.denied.focus, true);
    assert.equal(r.denied.buttonInert, true, 'the rest of the page is inert while expanded');
    assert.equal(r.denied.videoInert, false);
    assert.equal(r.denied.link, 'https://media.example.test/clips/demo.mp4');
    assert.equal(r.denied.height, true);
    assert.deepEqual(r.closed, { open: false, focus: true, inert: 0, role: null });
    assert.deepEqual(r.blocked, { calls: 2, open: true }, 'a forbidding frame skips the request and expands in-frame');
    assert.deepEqual(r.final, { open: false, focus: true, videos: 1, same: true, connected: true, paused: true, autoplay: false, moved: [] });
  });
});
