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
    `);
    assert.deepEqual(r.video, { paused: true, autoplay: false, preload: 'none', controls: true, readyState: 0 });
    assert.deepEqual(r.decoded, [true]);
    assert.equal(r.fallback, 'flex');
    assert.equal(r.scripts, 1, 'only the test harness script; proof cards add none');
  });
});
