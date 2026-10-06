// Public renderer API: card configs in, one self-contained HTML document out.

import { readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, jsonForScript } from './html.mjs';
import { assertValidCard, CARD_TYPES, INPUT_TYPES, validateCard } from './schema.mjs';
import * as appNameChoice from './templates/app-name-choice.mjs';
import * as bigText from './templates/big-text.mjs';
import * as bulletPoints from './templates/bullet-points.mjs';
import * as checklist from './templates/checklist.mjs';
import * as explanation from './templates/explanation.mjs';
import * as form from './templates/form.mjs';
import * as imageChoice from './templates/image-choice.mjs';
import * as yesNo from './templates/yes-no.mjs';

export { CARD_TYPES, INPUT_TYPES, validateCard, assertValidCard };
export { buildPayload, RESPONSE_SCHEMA, RESPONSE_VERSION } from './client/core.mjs';

const SRC = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = {
  'yes-no': yesNo,
  form,
  checklist,
  'bullet-points': bulletPoints,
  'big-text': bigText,
  explanation,
  'image-choice': imageChoice,
  'app-name-choice': appNameChoice,
};

const IMAGE_TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };
const DATA_IMAGE = /^data:image\/(svg\+xml|png|jpeg|gif|webp|avif)(;[a-z0-9=-]+)*(;base64)?,/i;
const MAX_IMAGE_BYTES = 350_000; // base64 adds ~33%; T3 caps documents at 512k characters
const MAX_HTML_CHARS = 512_000;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/;

let cachedAssets;
function assets() {
  if (cachedAssets) return cachedAssets;
  const strip = (file) =>
    readFileSync(resolve(SRC, file), 'utf8')
      .replace(/^import .*$/gm, '')
      .replace(/^export (?=const|function|async function)/gm, '');
  cachedAssets = {
    // Light minification: drop comments and collapse whitespace (no string literals in the stylesheet rely on it).
    css: readFileSync(resolve(SRC, 'styles.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};,>])\s*/g, '$1')
      .trim(),
    js: `(() => {\n'use strict';\n${strip('client/core.mjs')}\n${strip('client/dom.mjs')}\n})();`,
  };
  return cachedAssets;
}

/**
 * Validate a webhook endpoint: https only (plain http allowed for localhost tests).
 * @param {string} value
 */
export function checkWebhookUrl(value) {
  let url;
  try {
    url = new URL(String(value).trim());
  } catch {
    throw new Error('Webhook URL is not a valid absolute URL.');
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Webhook URL must use https.');
  if (url.username || url.password) throw new Error('Webhook URL must not contain credentials.');
  return url.href;
}

/** Inline every local image as a data URI. Missing or unsupported images become a visible placeholder plus a warning. */
function resolveImages(cards, baseDir, warnings) {
  const images = new Map();
  for (const card of cards) {
    for (const option of card.type === 'image-choice' ? card.options : []) {
      const src = option.src;
      if (images.has(src)) continue;
      const fail = (reason) => {
        warnings.push(`${card.id}/${option.id}: ${reason}`);
        images.set(src, { missing: true });
      };
      if (src.startsWith('data:')) {
        if (DATA_IMAGE.test(src)) images.set(src, { dataUri: src });
        else fail('data URI is not a supported image type');
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(src) && !/^[a-z]:[\\/]/i.test(src)) {
        fail('remote images are not embedded; download the file and reference the local path');
        continue;
      }
      const path = isAbsolute(src) ? src : resolve(baseDir, src);
      const type = IMAGE_TYPES[extname(path).toLowerCase()];
      if (!type) {
        fail(`unsupported image type "${extname(path) || '(none)'}"`);
        continue;
      }
      try {
        if (statSync(path).size > MAX_IMAGE_BYTES) {
          fail(`image is larger than ${MAX_IMAGE_BYTES / 1000} kB`);
          continue;
        }
        images.set(src, { dataUri: `data:${type};base64,${readFileSync(path).toString('base64')}` });
      } catch {
        fail('image file not found or unreadable');
      }
    }
  }
  return images;
}

/**
 * Render one or more cards into a standalone HTML document (inline CSS/JS/images, no network assets).
 *
 * @param {object | object[]} input card config or list of configs, rendered as one stack
 * @param {object} [options]
 * @param {string} [options.webhookUrl] callback endpoint; omit for an honest local preview that never sends
 * @param {string} [options.requestId] runtime id echoed in every payload; required with webhookUrl
 * @param {string} [options.baseDir] directory for relative image paths (default: cwd)
 * @param {string} [options.title] document <title>
 * @returns {{ html: string, mode: 'live' | 'preview', requestId: string, cards: { id: string, type: string, interactive: boolean }[], warnings: string[] }}
 */
export function renderCards(input, options = {}) {
  const cards = Array.isArray(input) ? input : [input];
  if (!cards.length) throw new Error('Nothing to render: provide at least one card config.');
  cards.forEach((card, i) => assertValidCard(card, cards.length > 1 ? `card #${i + 1} (${card?.id ?? 'no id'})` : `card "${card?.id ?? 'no id'}"`));
  const ids = cards.map((c) => c.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) throw new Error(`Card ids must be unique within a document; "${dupe}" repeats.`);

  const endpoint = options.webhookUrl ? checkWebhookUrl(options.webhookUrl) : null;
  const requestId = options.requestId ?? (endpoint ? null : 'preview');
  if (!requestId) throw new Error('requestId is required when a webhookUrl is set, so callbacks can be matched and deduplicated.');
  if (!REQUEST_ID.test(requestId)) throw new Error('requestId must use letters, digits, and _ . : - (max 96).');

  const warnings = [];
  const ctx = { live: Boolean(endpoint), images: resolveImages(cards, options.baseDir ?? process.cwd(), warnings) };
  const body = cards.map((card) => TEMPLATES[card.type].render(card, ctx)).join('\n');
  const needsScript = cards.some((c) => INPUT_TYPES.includes(c.type));
  const { css, js } = assets();
  // Defense in depth: no external fetches except the configured webhook origin, no form posts, no <base> hijack.
  const csp = `connect-src ${endpoint ? new URL(endpoint).origin : "'none'"}; img-src data:; form-action 'none'; base-uri 'none'; object-src 'none'`;
  const title = options.title ?? cards[0].title;

  const html = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    `<title>${esc(title)}</title>`,
    `<style>\n${css}\n</style>`,
    '</head>',
    '<body>',
    `<main class="uc-stack">\n${body}\n</main>`,
    needsScript && `<script type="application/json" id="uc-data">${jsonForScript({ v: 1, endpoint, requestId })}</script>`,
    needsScript && `<script>\n${js}\n</script>`,
    '</body>',
    '</html>',
    '',
  ]
    .filter(Boolean)
    .join('\n');

  if (html.length > MAX_HTML_CHARS) warnings.push(`document is ${html.length} characters; T3 html_render accepts at most ${MAX_HTML_CHARS}`);
  return {
    html,
    mode: endpoint ? 'live' : 'preview',
    requestId,
    cards: cards.map((c) => ({ id: c.id, type: c.type, interactive: INPUT_TYPES.includes(c.type) })),
    warnings,
  };
}

/** Convenience for a single card. */
export const renderCard = (config, options) => renderCards([config], options);

/**
 * Read a JSON card config. Relative image paths are resolved against the config file's directory.
 * @param {string} file
 */
export function loadCard(file) {
  const path = resolve(file);
  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read card config ${file}: ${error.message}`);
  }
  if (config?.type === 'image-choice' && Array.isArray(config.options)) {
    for (const option of config.options) {
      const src = option?.src;
      if (typeof src === 'string' && src && !/^[a-z][a-z0-9+.-]*:/i.test(src) && !isAbsolute(src)) option.src = resolve(dirname(path), src);
    }
  }
  return config;
}
