#!/usr/bin/env node
// Render card configs into one self-contained HTML document.
// The webhook URL is read from an environment variable or an untracked JSON file, never from argv.

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadCard, renderCards, validateCard } from '../src/index.mjs';

const USAGE = `Usage:
  node scripts/render.mjs --config <card.json> [--config <more.json>] --output <file.html|->
                          [--request-id <id>] [--title <text>] [--strict]
                          [--webhook-env [NAME] | --webhook-file <path.local.json>]
  node scripts/render.mjs --check <card.json>...

Webhook (opt-in; omitted = preview mode that never sends):
  --webhook-env [NAME]   read the URL from env NAME (default UPDATE_CARDS_WEBHOOK_URL)
  --webhook-file PATH    read {"webhookUrl": "..."} from an untracked JSON file
A request id is generated when a webhook is used without --request-id. The summary printed
on completion lists mode, requestId, and card ids (never the URL).`;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

// --webhook-env takes an optional value; normalize a bare flag before parseArgs.
const argv = process.argv.slice(2);
const envFlag = argv.indexOf('--webhook-env');
if (envFlag !== -1 && (argv[envFlag + 1] === undefined || argv[envFlag + 1].startsWith('--'))) argv.splice(envFlag + 1, 0, 'UPDATE_CARDS_WEBHOOK_URL');
if (argv.some((a) => a === '--webhook-url' || a.startsWith('--webhook-url='))) {
  fail('--webhook-url is not supported: command lines leak into shell history and process lists.\nExport UPDATE_CARDS_WEBHOOK_URL and pass --webhook-env, or use --webhook-file <path.local.json>.');
}

let args;
try {
  args = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: 'string', short: 'c', multiple: true },
      output: { type: 'string', short: 'o' },
      'request-id': { type: 'string' },
      title: { type: 'string' },
      'webhook-env': { type: 'string' },
      'webhook-file': { type: 'string' },
      check: { type: 'boolean' },
      strict: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
} catch (error) {
  fail(`${error.message}\n\n${USAGE}`);
}
const { values: opts, positionals } = args;
if (opts.help) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const files = [...(opts.config ?? []), ...positionals];
if (!files.length) fail(USAGE);

if (opts.check) {
  let bad = 0;
  for (const file of files) {
    let errors;
    try {
      errors = validateCard(loadCard(file));
    } catch (error) {
      errors = [{ path: '', message: error.message }];
    }
    if (errors.length) bad++;
    process.stdout.write(errors.length ? `✗ ${file}\n${errors.map((e) => `    ${e.path || '(root)'}: ${e.message}`).join('\n')}\n` : `✓ ${file}\n`);
  }
  process.exit(bad ? 1 : 0);
}

if (!opts.output) fail(`--output is required.\n\n${USAGE}`);
if (opts['webhook-env'] && opts['webhook-file']) fail('Use either --webhook-env or --webhook-file, not both.');

let webhookUrl;
if (opts['webhook-env']) {
  webhookUrl = process.env[opts['webhook-env']];
  if (!webhookUrl) fail(`Environment variable ${opts['webhook-env']} is empty or unset.`);
} else if (opts['webhook-file']) {
  try {
    webhookUrl = JSON.parse(readFileSync(opts['webhook-file'], 'utf8')).webhookUrl;
  } catch (error) {
    fail(`Could not read webhook file: ${error.message}`);
  }
  if (typeof webhookUrl !== 'string' || !webhookUrl) fail('Webhook file must contain {"webhookUrl": "https://..."}.');
}

const requestId = opts['request-id'] ?? (webhookUrl ? `req_${randomBytes(9).toString('base64url')}` : undefined);

let result;
try {
  result = renderCards(files.map(loadCard), { webhookUrl, requestId, title: opts.title });
} catch (error) {
  fail(error.message);
}
for (const warning of result.warnings) process.stderr.write(`warning: ${warning}\n`);
if (opts.strict && result.warnings.length) fail('Failing because of warnings (--strict).');

const summary = { output: opts.output, bytes: Buffer.byteLength(result.html), mode: result.mode, requestId: result.requestId, cards: result.cards, warnings: result.warnings };
if (opts.output === '-') {
  process.stdout.write(result.html);
  process.stderr.write(`${JSON.stringify(summary)}\n`);
} else {
  writeFileSync(opts.output, result.html);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
