// Escaping and small markup helpers. Every piece of config text goes through these.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for HTML element content or quoted attribute values. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Escaped text where `backtick spans` become <code>. No other markup is interpreted. */
export const inline = (value) =>
  String(value ?? '')
    .split(/`([^`\n]+)`/)
    .map((part, i) => (i % 2 ? `<code>${esc(part)}</code>` : esc(part)))
    .join('');

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** Returns a normalized absolute http(s)/mailto URL, or null for anything else (javascript:, data:, relative…). */
export function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Serialize data for a <script type="application/json"> block without allowing tag breakout. */
export const jsonForScript = (data) =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Join truthy markup fragments. */
export const join = (...parts) => parts.flat(Infinity).filter((p) => p !== false && p != null && p !== '').join('');

/** External link with safe URL; returns '' when the URL is unsafe. */
export function link(href, label, className = 'uc-link') {
  const url = safeUrl(href);
  if (!url) return '';
  return `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${inline(label)}${ICONS.external}</a>`;
}

const svg = (body, size = 16) =>
  `<svg class="uc-icon" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  check: svg('<path d="M3.5 8.5l3 3 6-7"/>'),
  x: svg('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
  arrow: svg('<path d="M3 8h10M9 4l4 4-4 4"/>'),
  external: svg('<path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M12.5 3.5L7 9"/>', 12),
  dot: svg('<circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none"/>'),
  progress: svg('<circle cx="8" cy="8" r="5"/><path d="M8 3a5 5 0 010 10z" fill="currentColor" stroke="none"/>'),
  alert: svg('<path d="M8 4.5v4.25M8 11.25v.25"/><circle cx="8" cy="8" r="6"/>'),
  image: svg('<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><circle cx="6" cy="6.5" r="1.2"/><path d="M13.5 10.5l-3.5-3-6.5 5.5"/>', 20),
  star: svg('<path d="M8 2.75l1.6 3.3 3.65.5-2.65 2.55.65 3.6L8 11l-3.25 1.7.65-3.6L2.75 6.55l3.65-.5z" fill="currentColor" stroke="none"/>', 12),
  up: svg('<path d="M4 10l4-4 4 4"/>', 14),
  down: svg('<path d="M4 6l4 4 4-4"/>', 14),
};
