#!/usr/bin/env node
// Link this checkout into agent skill directories without replacing existing installations.
import { existsSync, lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

try {
  const { values } = parseArgs({ options: { target: { type: 'string', default: 'both' }, 'skills-dir': { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    console.log('Usage: node scripts/install-skill.mjs [--target codex|claude|both] [--skills-dir PATH]\nA custom skills directory installs one link. Existing files are never replaced.');
    process.exit(0);
  }
  if (!['codex', 'claude', 'both'].includes(values.target)) throw new Error('--target must be codex, claude, or both.');
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  if (!existsSync(join(root, 'SKILL.md'))) throw new Error('Run this script from a complete Update Cards checkout.');
  const directories = values['skills-dir'] ? [resolve(values['skills-dir'])] :
    (values.target === 'both' ? ['codex', 'claude'] : [values.target]).map((agent) => join(homedir(), `.${agent}`, 'skills'));
  // Preflight every destination before making any change.
  for (const directory of directories) {
    const destination = join(directory, 'update-cards');
    let entry;
    try { entry = lstatSync(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (entry) {
      let current;
      if (entry.isSymbolicLink()) try { current = realpathSync(destination); } catch { /* broken link: preserve it */ }
      if (current !== root) throw new Error(`Existing installation at ${destination}; move it yourself before installing. Nothing was replaced.`);
    }
  }
  for (const directory of directories) {
    const destination = join(directory, 'update-cards');
    if (!existsSync(destination)) {
      mkdirSync(directory, { recursive: true });
      symlinkSync(root, destination, process.platform === 'win32' ? 'junction' : 'dir');
    }
    console.log(`Installed: ${destination}`);
  }
  console.log('Restart or reload your agent session to discover the skill. Keep this checkout in place; git pull updates the installed skill.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
