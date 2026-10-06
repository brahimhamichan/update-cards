import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CARDS, ENDPOINT, ROOT, dataBlock, tempDir } from './helpers.mjs';

const URL_SECRET = 'https://hooks.example.test/secret-path-123';
function run(args, env = {}) {
  const clean = { ...process.env };
  delete clean.UPDATE_CARDS_WEBHOOK_URL;
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts/render.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...clean, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const writeCard = (dir, name, card) => (writeFileSync(join(dir, name), JSON.stringify(card)), join(dir, name));

test('--check exit codes', () => {
  const dir = tempDir();
  const good = writeCard(dir, 'good.json', CARDS['yes-no']);
  const bad = writeCard(dir, 'bad.json', { ...CARDS['yes-no'], bogus: 1 });
  assert.equal(run(['--check', good]).code, 0);
  const r = run(['--check', good, bad]);
  assert.equal(r.code, 1);
  assert.match(r.out, /bogus/);
  assert.equal(run(['--check', join(dir, 'missing.json')]).code, 1);
  assert.equal(run(['--check', 'examples/yes-no.json']).code, 0);
});

test('--webhook-url is refused', () => {
  const dir = tempDir();
  const card = writeCard(dir, 'c.json', CARDS['yes-no']);
  for (const args of [['--webhook-url', URL_SECRET], [`--webhook-url=${URL_SECRET}`]]) {
    const r = run(['-c', card, '-o', join(dir, 'o.html'), ...args]);
    assert.notEqual(r.code, 0);
    assert.ok(!(r.out + r.err).includes('secret-path-123'));
  }
});

test('preview render writes a file and reports mode', () => {
  const dir = tempDir();
  const card = writeCard(dir, 'c.json', CARDS['yes-no']);
  const out = join(dir, 'o.html');
  const r = run(['-c', card, '-o', out]);
  assert.equal(r.code, 0, r.err);
  const summary = JSON.parse(r.out);
  assert.equal(summary.mode, 'preview');
  assert.equal(dataBlock(readFileSync(out, 'utf8')).endpoint, null);
});

test('--webhook-env reads the env var and never prints the URL', () => {
  const dir = tempDir();
  const card = writeCard(dir, 'c.json', CARDS['yes-no']);
  const out = join(dir, 'o.html');
  const r = run(['-c', card, '-o', out, '--webhook-env'], { UPDATE_CARDS_WEBHOOK_URL: URL_SECRET });
  assert.equal(r.code, 0, r.err);
  const summary = JSON.parse(r.out);
  assert.equal(summary.mode, 'live');
  assert.match(summary.requestId, /^req_[A-Za-z0-9_-]+$/);
  assert.ok(!(r.out + r.err).includes('secret-path-123') && !(r.out + r.err).includes('hooks.example.test'));
  const data = dataBlock(readFileSync(out, 'utf8'));
  assert.equal(data.endpoint, URL_SECRET);
  assert.equal(data.requestId, summary.requestId);
});

test('--webhook-env NAME, --request-id, and unset env failure', () => {
  const dir = tempDir();
  const card = writeCard(dir, 'c.json', CARDS['yes-no']);
  const out = join(dir, 'o.html');
  const ok = run(['-c', card, '-o', out, '--webhook-env', 'MY_HOOK', '--request-id', 'req_mine'], { MY_HOOK: ENDPOINT });
  assert.equal(ok.code, 0, ok.err);
  assert.equal(JSON.parse(ok.out).requestId, 'req_mine');
  const bad = run(['-c', card, '-o', out, '--webhook-env']);
  assert.notEqual(bad.code, 0);
  assert.match(bad.err, /UPDATE_CARDS_WEBHOOK_URL/);
});

test('--webhook-file works and never prints the URL', () => {
  const dir = tempDir();
  const card = writeCard(dir, 'c.json', CARDS['yes-no']);
  const hook = join(dir, 'hook.local.json');
  writeFileSync(hook, JSON.stringify({ webhookUrl: URL_SECRET }));
  const out = join(dir, 'o.html');
  const r = run(['-c', card, '-o', out, '--webhook-file', hook]);
  assert.equal(r.code, 0, r.err);
  assert.ok(!(r.out + r.err).includes('secret-path-123'));
  assert.equal(dataBlock(readFileSync(out, 'utf8')).endpoint, URL_SECRET);
  writeFileSync(hook, '{}');
  assert.notEqual(run(['-c', card, '-o', out, '--webhook-file', hook]).code, 0);
});

test('multiple configs, --output - and --strict', () => {
  const dir = tempDir();
  const a = writeCard(dir, 'a.json', CARDS['yes-no']);
  const b = writeCard(dir, 'b.json', CARDS['big-text']);
  const r = run(['-c', a, '-c', b, '-o', '-']);
  assert.equal(r.code, 0, r.err);
  assert.ok(r.out.startsWith('<!doctype html>'));
  assert.deepEqual(JSON.parse(r.err.trim().split('\n').pop()).cards.map((c) => c.id), ['yn', 'bt']);
  const img = writeCard(dir, 'i.json', { type: 'image-choice', id: 'i', title: 'T', options: [{ id: 'a', src: 'missing.svg', alt: 'A' }, { id: 'b', src: 'missing2.svg', alt: 'B' }] });
  assert.equal(run(['-c', img, '-o', join(dir, 'o.html')]).code, 0);
  assert.notEqual(run(['-c', img, '-o', join(dir, 'o.html'), '--strict']).code, 0);
});

test('invalid config fails with path-specific error and no output', () => {
  const dir = tempDir();
  const bad = writeCard(dir, 'bad.json', { ...CARDS.checklist, minChecked: 9 });
  const out = join(dir, 'o.html');
  const r = run(['-c', bad, '-o', out]);
  assert.notEqual(r.code, 0);
  assert.match(r.err, /minChecked/);
  assert.throws(() => readFileSync(out));
});
