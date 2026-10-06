import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPayload, RESPONSE_SCHEMA, RESPONSE_VERSION } from '../src/index.mjs';
import { collectValues, sendPayload } from '../src/client/core.mjs';

test('buildPayload envelope', () => {
  const now = new Date('2026-01-02T03:04:05.678Z');
  const p = buildPayload({ requestId: 'req_1', cardId: 'c', type: 'yes-no', action: 'answer', values: { answer: 'yes' }, now });
  assert.deepEqual(p, {
    schema: 'update-cards.response',
    version: 1,
    requestId: 'req_1',
    cardId: 'c',
    type: 'yes-no',
    action: 'answer',
    values: { answer: 'yes' },
    attempt: 1,
    submittedAt: '2026-01-02T03:04:05.678Z',
  });
  assert.equal(RESPONSE_SCHEMA, p.schema);
  assert.equal(RESPONSE_VERSION, 1);
  assert.equal(buildPayload({ requestId: 'r', cardId: 'c', type: 't', action: 'a', values: {}, attempt: 3 }).attempt, 3);
  assert.match(buildPayload({ requestId: 'r', cardId: 'c', type: 't', action: 'a', values: {} }).submittedAt, /^\d{4}-\d\d-\d\dT[\d:.]+Z$/);
});

test('collectValues semantics', () => {
  const box = (name, value, checked, multi = true) => ({ name, kind: 'checkbox', value, checked, multi });
  const radio = (name, value, checked) => ({ name, kind: 'radio', value, checked });
  assert.deepEqual(collectValues([box('tags', 'a', true), box('tags', 'b', false), box('tags', 'c', true)]), { tags: ['a', 'c'] });
  assert.deepEqual(collectValues([box('tags', 'a', false), box('tags', 'b', false)]), { tags: [] }, 'empty multi group is []');
  assert.deepEqual(collectValues([box('agree', 'true', true, false)]), { agree: true });
  assert.deepEqual(collectValues([box('agree', 'true', false, false)]), { agree: false });
  assert.deepEqual(collectValues([radio('c', 'r', false), radio('c', 'b', false)]), { c: null });
  assert.deepEqual(collectValues([radio('c', 'r', false), radio('c', 'b', true)]), { c: 'b' });
  assert.deepEqual(collectValues([{ name: 't', kind: 'text', value: '  hi  ' }, { name: 'u', kind: 'textarea', value: undefined }, { kind: 'text', value: 'x' }]), { t: 'hi', u: '' });
  assert.deepEqual(collectValues([{ name: 'note', kind: 'textarea', value: '   ' }]), {}, 'empty note dropped');
  assert.deepEqual(collectValues([{ name: 'note', kind: 'textarea', value: ' hey ' }]), { note: 'hey' });
  assert.deepEqual(collectValues([{ name: 'other', kind: 'text', value: '' }]), { other: '' }, 'only note is dropped when empty');
});

test('sendPayload posts a CORS-simple, credential-less request', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => (calls.push({ url, options }), { ok: true });
  const payload = buildPayload({ requestId: 'r', cardId: 'c', type: 'form', action: 'submit', values: { a: '1' } });
  await sendPayload('https://hooks.example.test/x', payload, fetchImpl);
  assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.equal(url, 'https://hooks.example.test/x');
  const { signal, ...rest } = options;
  assert.deepEqual(rest, {
    method: 'POST',
    mode: 'no-cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(payload),
  });
  assert.ok(signal instanceof AbortSignal && !signal.aborted);
});

test('form field names matching object properties keep their submitted values', () => {
  assert.deepEqual(collectValues([
    { name: 'constructor', kind: 'checkbox', multi: true, checked: true, value: 'a' },
    { name: 'toString', kind: 'radio', checked: true, value: 'b' },
  ]), { constructor: ['a'], toString: 'b' });
});

test('sendPayload propagates fetch failures', async () => {
  await assert.rejects(sendPayload('https://x.test', {}, async () => { throw new TypeError('network'); }), /network/);
});
