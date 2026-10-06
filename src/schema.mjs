// Declarative card config schemas and a small strict validator (unknown keys are errors).

import { DATA_IMAGE, hasScheme, safeUrl, safeWebUrl } from './html.mjs';

const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const TIMESTAMP = /^(?:\d{1,2}:)?[0-5]?\d:[0-5]\d$/;

const str = (max, opts = {}) => ({ kind: 'string', max, ...opts });
const req = (rule) => ({ ...rule, required: true });
const bool = () => ({ kind: 'boolean' });
const int = (min, max) => ({ kind: 'integer', min, max });
const oneOf = (...values) => ({ kind: 'enum', values });
const arr = (item, min, max) => ({ kind: 'array', item, min, max });
const obj = (shape, check) => ({ kind: 'object', shape, check });
const any = (...rules) => ({ kind: 'any', rules });
const id = () => str(64, { pattern: ID, patternHint: 'letters, digits, and _ . : - (max 64, starting with a letter or digit)' });

export const TONES = ['neutral', 'info', 'success', 'warning', 'danger'];

const COMMON = {
  type: req(str(32)),
  id: req(id()),
  title: req(str(160)),
  eyebrow: str(40),
  body: str(600),
  tone: oneOf(...TONES),
  index: int(1, 99),
};

const INPUT = {
  submitLabel: str(32),
  allowNote: bool(),
  noteLabel: str(60),
  notePlaceholder: str(120),
};

const linkFields = { href: str(2048, { url: true }), linkLabel: str(40) };
// Proof media: images are local files or image data URIs (inlined at render); videos are local files or http(s) URLs.
const image = () => str(4096, { media: 'image' });
const webLinkFields = { href: str(2048, { web: true }), linkLabel: str(40) };
const facts = arr(obj({ label: req(str(24)), value: req(str(80)) }), 1, 6);
const cta = obj({ label: req(str(40)), href: req(str(2048, { url: true })) });
const uniqueIds = (key, label = key) => (list, path, errors) => {
  const seen = new Set();
  list?.forEach((item, i) => {
    const value = item?.[key];
    if (value == null) return;
    if (seen.has(value)) errors.push(err(`${path}[${i}].${key}`, `duplicate ${label} "${value}"`));
    seen.add(value);
  });
};

const optionValue = obj({ value: req(str(64)), label: req(str(80)) });
const FIELD_TYPES = ['text', 'textarea', 'select', 'radio', 'checkbox'];

const field = obj(
  {
    id: req(id()),
    type: req(oneOf(...FIELD_TYPES)),
    label: req(str(80)),
    help: str(160),
    required: bool(),
    placeholder: str(120),
    inputType: oneOf('text', 'email', 'url', 'number', 'tel'),
    rows: int(2, 10),
    maxLength: int(1, 5000),
    options: arr(optionValue, 1, 12),
    default: any(str(5000), bool(), arr(str(64), 0, 12)),
  },
  (f, path, errors) => {
    const choices = f.options?.map((o) => o.value) ?? [];
    const needsOptions = f.type === 'select' || f.type === 'radio';
    if (needsOptions && choices.length < 2) errors.push(err(`${path}.options`, `${f.type} fields need at least 2 options`));
    if (!needsOptions && f.type !== 'checkbox' && f.options) errors.push(err(`${path}.options`, `not allowed for ${f.type} fields`));
    if (f.inputType && f.type !== 'text') errors.push(err(`${path}.inputType`, 'only allowed for text fields'));
    if (f.rows && f.type !== 'textarea') errors.push(err(`${path}.rows`, 'only allowed for textarea fields'));
    if (f.placeholder && !['text', 'textarea'].includes(f.type)) errors.push(err(`${path}.placeholder`, 'only allowed for text and textarea fields'));
    if (f.maxLength && !['text', 'textarea'].includes(f.type)) errors.push(err(`${path}.maxLength`, 'only allowed for text and textarea fields'));
    uniqueIds('value')(f.options, `${path}.options`, errors);
    if (f.default === undefined) return;
    const group = f.type === 'checkbox' && f.options;
    const expected = group ? 'array' : f.type === 'checkbox' ? 'boolean' : 'string';
    const actual = Array.isArray(f.default) ? 'array' : typeof f.default;
    if (actual !== expected) return errors.push(err(`${path}.default`, `must be a ${expected} for this field`));
    const defaults = group ? f.default : needsOptions ? [f.default] : [];
    defaults.filter((v) => !choices.includes(v)).forEach((v) => errors.push(err(`${path}.default`, `"${v}" is not one of the options`)));
  },
);

const SCHEMAS = {
  'yes-no': {
    ...INPUT,
    yesLabel: str(24),
    noLabel: str(24),
    destructive: bool(),
  },
  form: {
    ...INPUT,
    fields: req(arr(field, 1, 12)),
  },
  checklist: {
    ...INPUT,
    minChecked: int(0, 20),
    items: req(arr(obj({ id: req(id()), label: req(str(140)), detail: str(240), checked: bool(), ...linkFields }), 1, 20)),
  },
  'bullet-points': {
    items: req(arr(obj({ text: req(str(240)), detail: str(240), status: oneOf('done', 'progress', 'blocked', 'next', 'info'), ...linkFields }), 1, 12)),
    footer: str(240),
  },
  'big-text': {
    value: req(str(24)),
    label: str(80),
    supporting: str(240),
    delta: obj({ text: req(str(24)), direction: oneOf('up', 'down', 'flat'), tone: oneOf(...TONES) }),
    cta,
  },
  explanation: {
    variant: req(oneOf('steps', 'flow', 'comparison')),
    steps: arr(obj({ title: req(str(80)), detail: str(240), more: str(600) }), 2, 8),
    nodes: arr(obj({ label: req(str(40)), detail: str(120) }), 2, 6),
    columns: arr(
      obj({
        title: req(str(60)),
        summary: str(160),
        recommended: bool(),
        points: req(arr(any(str(160), obj({ text: req(str(160)), kind: oneOf('pro', 'con', 'neutral') })), 1, 6)),
      }),
      2,
      3,
    ),
    reveal: obj({ label: req(str(60)), body: req(str(1200)) }),
  },
  'image-choice': {
    ...INPUT,
    aspect: oneOf('1:1', '4:3', '16:9'),
    imageBackground: oneOf('light', 'dark', 'none'),
    options: req(arr(obj({ id: req(id()), src: req(str(4096)), alt: req(str(160)), caption: str(60) }), 2, 24)),
  },
  'video-walkthrough': {
    src: req(str(4096, { media: 'video' })),
    mimeType: oneOf('video/mp4', 'video/webm', 'video/ogg'),
    poster: image(),
    aspect: oneOf('16:9', '4:3', '1:1'),
    caption: str(240),
    chapters: arr(obj({ time: req(str(8, { pattern: TIMESTAMP, patternHint: 'm:ss or h:mm:ss' })), label: req(str(80)) }), 1, 12),
    ...webLinkFields,
    facts,
  },
  'screenshot-proof': {
    layout: oneOf('gallery', 'before-after'),
    shots: req(arr(obj({ src: req(image()), alt: req(str(160)), label: str(24), caption: str(160), ...webLinkFields }), 1, 6)),
    facts,
  },
  'app-name-choice': {
    ...INPUT,
    options: req(arr(obj({ id: req(id()), name: req(str(40)), tagline: str(90), rationale: str(240), recommended: bool() }), 2, 12)),
  },
};

export const CARD_TYPES = Object.keys(SCHEMAS);
export const INPUT_TYPES = CARD_TYPES.filter((t) => 'submitLabel' in SCHEMAS[t]);

const VARIANT_KEYS = { steps: 'steps', flow: 'nodes', comparison: 'columns' };

/** Cross-field checks per card type. */
const CHECKS = {
  form: (c, errors) => {
    uniqueIds('id', 'field id')(c.fields, 'fields', errors);
    c.fields?.forEach((f, i) => f?.id === 'note' && errors.push(err(`fields[${i}].id`, '"note" is reserved for the allowNote box')));
  },
  checklist: (c, errors) => {
    uniqueIds('id', 'item id')(c.items, 'items', errors);
    if (c.minChecked > (c.items?.length ?? 0)) errors.push(err('minChecked', 'cannot exceed the number of items'));
  },
  explanation: (c, errors) => {
    const wanted = VARIANT_KEYS[c.variant];
    Object.values(VARIANT_KEYS).forEach((key) => {
      if (key === wanted && !c[key]) errors.push(err(key, `required for the ${c.variant} variant`));
      if (key !== wanted && c[key]) errors.push(err(key, `not used by the ${c.variant} variant; use ${wanted}`));
    });
  },
  'image-choice': (c, errors) => uniqueIds('id', 'option id')(c.options, 'options', errors),
  'video-walkthrough': (c, errors) => {
    const seconds = (c.chapters ?? []).map((ch) => ch.time.split(':').reduce((total, part) => total * 60 + Number(part), 0));
    if (seconds.some((s, i) => i > 0 && s <= seconds[i - 1])) errors.push(err('chapters', 'times must increase'));
  },
  'screenshot-proof': (c, errors) => {
    if (c.layout === 'before-after' && c.shots.length !== 2) errors.push(err('shots', 'the before-after layout needs exactly 2 shots'));
  },
  'app-name-choice': (c, errors) => {
    uniqueIds('id', 'option id')(c.options, 'options', errors);
    if ((c.options ?? []).filter((o) => o.recommended).length > 1) errors.push(err('options', 'mark at most one option as recommended'));
  },
};

function err(path, message) {
  return { path, message };
}

function check(rule, value, path, errors) {
  if (value === undefined || value === null) {
    if (rule.required) errors.push(err(path, 'is required'));
    return;
  }
  switch (rule.kind) {
    case 'string':
      if (typeof value !== 'string') return errors.push(err(path, 'must be a string'));
      if (rule.required && !value.trim()) return errors.push(err(path, 'must not be empty'));
      if (value.length > rule.max) errors.push(err(path, `must be at most ${rule.max} characters`));
      if (rule.pattern && !rule.pattern.test(value)) errors.push(err(path, `must use ${rule.patternHint}`));
      if (rule.url && !safeUrl(value)) errors.push(err(path, 'must be an absolute http(s) or mailto URL'));
      if (rule.web && !safeWebUrl(value)) errors.push(err(path, 'must be an absolute http(s) URL'));
      if (rule.media === 'image' && hasScheme(value) && !DATA_IMAGE.test(value)) errors.push(err(path, 'must be a local image path or an image data: URI'));
      if (rule.media === 'video' && hasScheme(value) && !safeWebUrl(value)) errors.push(err(path, 'must be a local video path or an absolute http(s) URL'));
      return;
    case 'boolean':
      if (typeof value !== 'boolean') errors.push(err(path, 'must be true or false'));
      return;
    case 'integer':
      if (!Number.isInteger(value) || value < rule.min || value > rule.max) errors.push(err(path, `must be an integer from ${rule.min} to ${rule.max}`));
      return;
    case 'enum':
      if (!rule.values.includes(value)) errors.push(err(path, `must be one of: ${rule.values.join(', ')}`));
      return;
    case 'array':
      if (!Array.isArray(value)) return errors.push(err(path, 'must be an array'));
      if (value.length < rule.min || value.length > rule.max) errors.push(err(path, `must have ${rule.min}–${rule.max} items`));
      value.forEach((item, i) => check({ ...rule.item, required: true }, item, `${path}[${i}]`, errors));
      return;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) return errors.push(err(path, 'must be an object'));
      const before = errors.length;
      checkShape(rule.shape, value, path, errors);
      if (errors.length === before) rule.check?.(value, path, errors);
      return;
    case 'any': {
      const attempts = rule.rules.map((r) => {
        const e = [];
        check({ ...r, required: true }, value, path, e);
        return e;
      });
      if (!attempts.some((e) => e.length === 0)) errors.push(...attempts.sort((a, b) => a.length - b.length)[0]);
      return;
    }
  }
}

function checkShape(shape, value, path, errors) {
  const prefix = path ? `${path}.` : '';
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(shape, key)) errors.push(err(`${prefix}${key}`, 'is not a recognized field'));
  }
  for (const [key, rule] of Object.entries(shape)) check(rule, value[key], `${prefix}${key}`, errors);
}

/**
 * Validate a card config. Returns a list of `{ path, message }`; empty when valid.
 * @param {unknown} config
 */
export function validateCard(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [err('', 'card config must be a JSON object')];
  if (!CARD_TYPES.includes(config.type)) return [err('type', `must be one of: ${CARD_TYPES.join(', ')}`)];
  checkShape({ ...COMMON, ...SCHEMAS[config.type] }, config, '', errors);
  if (!errors.length) CHECKS[config.type]?.(config, errors);
  return errors;
}

/** Throw a readable error when a config is invalid. */
export function assertValidCard(config, source = 'card') {
  const errors = validateCard(config);
  if (errors.length) {
    const lines = errors.map((e) => `  - ${e.path || '(root)'}: ${e.message}`);
    const error = new Error(`Invalid ${source}:\n${lines.join('\n')}`);
    error.validationErrors = errors;
    throw error;
  }
  return config;
}
