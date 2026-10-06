import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCard } from '../src/index.mjs';
import { CARDS, EXAMPLES, readJson } from './helpers.mjs';

const paths = (config) => validateCard(config).map((e) => e.path);
const msgs = (config) => validateCard(config).map((e) => `${e.path}: ${e.message}`).join('\n');
const with_ = (base, patch) => structuredClone({ ...base, ...patch });

test('every example and fixture config is valid', () => {
  assert.ok(EXAMPLES.length > 0);
  for (const file of EXAMPLES) assert.deepEqual(validateCard(readJson(file)), [], file);
  for (const [name, card] of Object.entries(CARDS)) assert.deepEqual(validateCard(card), [], name);
});

test('non-object and unknown types are rejected', () => {
  assert.equal(validateCard(null).length, 1);
  assert.equal(validateCard([]).length, 1);
  assert.deepEqual(paths({ type: 'nope' }), ['type']);
});

test('malformed collections report validation errors without throwing', () => {
  for (const config of [
    { ...CARDS.form, fields: 3 },
    { ...CARDS.form, fields: [{ id: 'f', type: 'select', label: 'L', options: {} }] },
    { ...CARDS['app-name-choice'], options: 3 },
    { ...CARDS.checklist, items: [null] },
  ]) assert.ok(validateCard(config).length > 0);
  assert.ok(paths({ ...CARDS['yes-no'], constructor: 'unknown' }).includes('constructor'));
});

test('unknown keys and missing required fields report their path', () => {
  assert.ok(paths(with_(CARDS['yes-no'], { bogus: 1 })).includes('bogus'));
  const { title, ...noTitle } = CARDS['yes-no'];
  assert.ok(paths(noTitle).includes('title'));
  assert.ok(paths(with_(CARDS.checklist, { items: [{ id: 'a', extra: 1 }] })).includes('items[0].extra'));
  assert.ok(paths(with_(CARDS.checklist, { items: [{ id: 'a' }] })).includes('items[0].label'));
});

test('ids must match the id pattern', () => {
  for (const id of ['has space', '-lead', '<x>', 'a'.repeat(65), '']) assert.ok(paths(with_(CARDS['yes-no'], { id })).includes('id'), id);
  assert.deepEqual(paths(with_(CARDS['yes-no'], { id: 'ok_1.a:b-c' })), []);
});

test('duplicate ids are rejected with indexed paths', () => {
  const dup = (id) => ({ id, label: id });
  assert.ok(paths(with_(CARDS.checklist, { items: [dup('a'), dup('a')] })).includes('items[1].id'));
  assert.ok(paths(with_(CARDS['app-name-choice'], { options: [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }] })).includes('options[1].id'));
  assert.ok(paths(with_(CARDS['app-name-choice'], { options: [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }] })).includes('options[1].id'));
  const fields = [{ id: 'f', type: 'text', label: 'A' }, { id: 'f', type: 'text', label: 'B' }];
  assert.ok(paths(with_(CARDS.form, { fields })).includes('fields[1].id'));
  const opts = [{ value: 'v', label: 'A' }, { value: 'v', label: 'B' }];
  assert.ok(paths(with_(CARDS.form, { fields: [{ id: 'f', type: 'select', label: 'S', options: opts }] })).includes('fields[0].options[1].value'));
});

test('select/radio need at least 2 options', () => {
  for (const type of ['select', 'radio']) {
    const fields = [{ id: 'f', type, label: 'L', options: [{ value: 'a', label: 'A' }] }];
    assert.match(msgs(with_(CARDS.form, { fields })), /fields\[0\]\.options: .*at least 2/);
  }
});

test('form defaults must fit the field', () => {
  const opts = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
  const field = (f) => with_(CARDS.form, { fields: [{ id: 'f', label: 'L', ...f }] });
  assert.ok(paths(field({ type: 'select', options: opts, default: 'zzz' })).includes('fields[0].default'));
  assert.ok(paths(field({ type: 'checkbox', options: opts, default: ['a', 'zzz'] })).includes('fields[0].default'));
  assert.ok(paths(field({ type: 'checkbox', default: 'yes' })).includes('fields[0].default'), 'single checkbox default must be boolean');
  assert.deepEqual(paths(field({ type: 'select', options: opts, default: 'a' })), []);
});

test('explanation variant must match its content key', () => {
  const noSteps = { type: 'explanation', id: 'e', title: 'T', variant: 'steps', nodes: [{ label: 'A' }, { label: 'B' }] };
  const p = paths(noSteps);
  assert.ok(p.includes('steps') && p.includes('nodes'));
  assert.ok(paths({ ...noSteps, variant: 'bad' }).includes('variant'));
});

test('at most one recommended app name', () => {
  const options = [{ id: 'a', name: 'A', recommended: true }, { id: 'b', name: 'B', recommended: true }];
  assert.ok(paths(with_(CARDS['app-name-choice'], { options })).includes('options'));
});

test('unsafe or relative hrefs are rejected', () => {
  const item = (href) => with_(CARDS['bullet-points'], { items: [{ text: 'x', href }] });
  for (const href of ['javascript:alert(1)', 'data:text/html,<b>x', '/relative', 'relative.html', '//evil.test', 'ftp://x.test/f', ' ']) {
    assert.ok(paths(item(href)).includes('items[0].href'), href);
  }
  for (const href of ['https://ok.test/a', 'http://ok.test', 'mailto:a@b.test']) assert.deepEqual(paths(item(href)), [], href);
  assert.ok(paths(with_(CARDS['big-text'], { cta: { label: 'Go', href: 'javascript:1' } })).includes('cta.href'));
});

test('minChecked cannot exceed item count', () => {
  assert.ok(paths(with_(CARDS.checklist, { minChecked: 3 })).includes('minChecked'));
  assert.deepEqual(paths(with_(CARDS.checklist, { minChecked: 2 })), []);
});

test('form field id "note" is reserved for the note box', () => {
  const card = { type: 'form', id: 'f', title: 'T', fields: [{ id: 'note', type: 'text', label: 'Note' }] };
  assert.deepEqual(paths(card), ['fields[0].id']);
});
