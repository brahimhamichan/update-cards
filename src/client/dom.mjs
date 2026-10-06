// Browser runtime: wires card controls to the shared response logic in core.mjs.
// Works inside `sandbox="allow-scripts"`: no native form submission, no inline handlers, no console output.

const STATUS = {
  sending: 'Sending…',
  sent: (what) => `Submitted${what ? ` ${what}` : ''}. Watch the chat for confirmation.`,
  error: 'Couldn’t reach the agent. Nothing was confirmed — try again.',
  demo: (what) => `Demo only${what ? ` · ${what}` : ''} — nothing was sent.`,
};

const data = JSON.parse(document.getElementById('uc-data')?.textContent || '{}');
const endpoint = typeof data.endpoint === 'string' && data.endpoint ? data.endpoint : null;

const quote = (text) => (text ? `“${text}”` : '');

function describe(card, values, trigger) {
  if (trigger?.dataset.ucValue) return quote(trigger.dataset.ucLabel);
  if (typeof values.choice === 'string') {
    const input = card.querySelector(`input[name="choice"][value="${CSS.escape(values.choice)}"]`);
    return quote(input?.dataset.ucLabel);
  }
  if (card.dataset.ucType === 'checklist') return `${values.checked.length} of ${values.checked.length + values.unchecked.length} checked`;
  return '';
}

function readControls(form) {
  return [...form.elements]
    .filter((el) => el.name && !el.disabled && el.type !== 'button' && el.type !== 'submit')
    .map((el) => ({ name: el.name, kind: el.type, value: el.value, checked: el.checked, multi: el.dataset.ucMulti === 'true' }));
}

/** Enforce "at least N checked" groups (form checkbox groups, checklist minChecked) through native validity. */
function checkGroups(form) {
  for (const group of form.querySelectorAll('[data-uc-min]')) {
    const boxes = [...group.querySelectorAll('input[type="checkbox"]')];
    const min = Number(group.dataset.ucMin);
    const count = boxes.filter((b) => b.checked).length;
    boxes[0]?.setCustomValidity(count >= min ? '' : group.dataset.ucMinMessage || `Select at least ${min}.`);
  }
}

function setState(card, state, message) {
  card.dataset.ucState = state;
  const status = card.querySelector('[data-uc-status]');
  if (status) status.textContent = message || '';
  const locked = state === 'sending' || state === 'sent' || state === 'demo';
  for (const el of card.querySelector('form')?.elements ?? []) if (!el.hasAttribute('data-uc-reset')) el.disabled = locked;
  card.querySelector('[data-uc-reset]')?.toggleAttribute('hidden', state !== 'demo');
}

function showPayload(card, payload) {
  let details = card.querySelector('[data-uc-payload]');
  if (!details) {
    details = document.createElement('details');
    details.className = 'uc-payload';
    details.dataset.ucPayload = '';
    details.innerHTML = '<summary>Payload preview</summary><pre></pre>';
    card.querySelector('.uc-footer')?.after(details);
  }
  details.hidden = false;
  details.querySelector('pre').textContent = JSON.stringify(payload, null, 2);
}

async function respond(card, form, trigger) {
  if (card.dataset.ucState === 'sending' || card.dataset.ucState === 'sent') return;
  checkGroups(form);
  if (!form.reportValidity()) return;

  const values = collectValues(readControls(form));
  if (trigger?.dataset.ucValue) values.answer = trigger.dataset.ucValue;
  if (card.dataset.ucType === 'checklist') {
    const all = [...form.querySelectorAll('input[name="checked"]')].map((el) => el.value);
    values.unchecked = all.filter((id) => !values.checked.includes(id));
  }
  card.querySelectorAll('[data-uc-chosen]').forEach((el) => el.removeAttribute('data-uc-chosen'));
  if (trigger?.dataset.ucValue) trigger.dataset.ucChosen = '';

  const attempt = Number(card.dataset.ucAttempt || 0) + 1;
  card.dataset.ucAttempt = String(attempt);
  const payload = buildPayload({
    requestId: data.requestId,
    cardId: card.dataset.ucCard,
    type: card.dataset.ucType,
    action: trigger?.dataset.ucAction || 'submit',
    values,
    attempt,
  });
  const what = describe(card, values, trigger);

  if (!endpoint) {
    setState(card, 'demo', STATUS.demo(what));
    showPayload(card, payload);
    return;
  }
  setState(card, 'sending', STATUS.sending);
  try {
    await sendPayload(endpoint, payload);
    setState(card, 'sent', STATUS.sent(what));
  } catch {
    setState(card, 'error', STATUS.error);
    trigger?.focus(); // controls were disabled while sending; give keyboard users their place back
  }
}

function wireCard(card) {
  const form = card.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', (event) => event.preventDefault());
  form.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-uc-action]');
    if (trigger && form.contains(trigger)) respond(card, form, trigger);
  });
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    const el = event.target;
    const isTextarea = el.tagName === 'TEXTAREA';
    if (isTextarea && !(event.metaKey || event.ctrlKey)) return; // plain Enter keeps the newline
    if (!isTextarea && (el.tagName !== 'INPUT' || ['checkbox', 'button', 'submit'].includes(el.type))) return;
    const primary = form.querySelector('[data-uc-primary]');
    if (!primary) return;
    event.preventDefault();
    respond(card, form, primary);
  });
  form.addEventListener('change', () => {
    checkGroups(form);
    updateProgress(card);
  });
  card.querySelector('[data-uc-reset]')?.addEventListener('click', () => {
    setState(card, 'idle', '');
    card.querySelector('[data-uc-payload]')?.setAttribute('hidden', '');
    card.querySelectorAll('[data-uc-chosen]').forEach((el) => el.removeAttribute('data-uc-chosen'));
  });
  updateProgress(card);
}

/** Checklist meter: "n of N", segment fill, and a done state when everything is checked. */
function updateProgress(card) {
  const meter = card.querySelector('[data-uc-progress]');
  if (!meter) return;
  const boxes = [...card.querySelectorAll('input[name="checked"]')];
  const done = boxes.filter((b) => b.checked).length;
  meter.querySelector('[data-uc-progress-label]').textContent = done === boxes.length ? `All ${done} done` : `${done} of ${boxes.length} done`;
  meter.querySelectorAll('[data-uc-segment]').forEach((seg, i) => seg.toggleAttribute('data-on', i < done));
  card.dataset.ucComplete = String(done === boxes.length);
}

function markMissing(img) {
  img.closest('[data-uc-media]')?.setAttribute('data-missing', '');
}

// decode() rejects for broken or undecodable images, including ones that failed before this script ran.
document.querySelectorAll('img[data-uc-img]').forEach((img) => img.decode().catch(() => img.naturalWidth > 0 || markMissing(img)));
document.querySelectorAll('[data-uc-card]').forEach(wireCard);
