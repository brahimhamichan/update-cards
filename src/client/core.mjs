// Pure response logic shared by the browser runtime and Node tests.
// Inlined into generated HTML by src/index.mjs (export keywords are stripped).

export const RESPONSE_SCHEMA = 'update-cards.response';
export const RESPONSE_VERSION = 1;
export const SEND_TIMEOUT_MS = 20000;

/** Build the callback payload. Values are user input and must be treated as untrusted by the receiver. */
export function buildPayload({ requestId, cardId, type, action, values, attempt = 1, now = new Date() }) {
  return {
    schema: RESPONSE_SCHEMA,
    version: RESPONSE_VERSION,
    requestId,
    cardId,
    type,
    action,
    values,
    attempt,
    submittedAt: now.toISOString(),
  };
}

/**
 * Collect values from `{ name, kind, value, checked, multi }` control descriptors.
 * kind: 'checkbox' | 'radio' | other. Multi checkboxes produce arrays, single ones booleans,
 * radio groups the checked value (or null), and other controls trimmed strings. Empty notes are dropped.
 */
export function collectValues(controls) {
  const values = Object.create(null);
  for (const c of controls) {
    if (!c.name) continue;
    if (c.kind === 'checkbox' && c.multi) {
      values[c.name] ??= [];
      if (c.checked) values[c.name].push(c.value);
    } else if (c.kind === 'checkbox') {
      values[c.name] = Boolean(c.checked);
    } else if (c.kind === 'radio') {
      if (!(c.name in values)) values[c.name] = null;
      if (c.checked) values[c.name] = c.value;
    } else {
      values[c.name] = String(c.value ?? '').trim();
    }
  }
  if (values.note === '') delete values.note;
  return { ...values };
}

/** POST as a CORS-simple request: no preflight, opaque response, so success only means "handed to the network". */
export function sendPayload(endpoint, payload, fetchImpl = fetch) {
  return fetchImpl(endpoint, {
    method: 'POST',
    mode: 'no-cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
}
