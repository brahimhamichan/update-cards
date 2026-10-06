import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const install = (directory) => spawnSync(process.execPath, [join(root, 'scripts/install-skill.mjs'), '--skills-dir', directory], { encoding: 'utf8' });

test('skill installer links the complete checkout and is safe to repeat', () => {
  const directory = mkdtempSync(join(tmpdir(), 'uc-install-'));
  try {
    assert.equal(install(directory).status, 0);
    assert.equal(realpathSync(join(directory, 'update-cards')), realpathSync(root));
    assert.equal(install(directory).status, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('skill installer preserves a conflicting existing file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'uc-conflict-'));
  try {
    const destination = join(directory, 'update-cards');
    writeFileSync(destination, 'existing user installation');
    const result = install(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Nothing was replaced/);
    assert.equal(readFileSync(destination, 'utf8'), 'existing user installation');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
