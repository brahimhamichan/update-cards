import { esc, join } from '../html.mjs';
import { footer, shell, submitButton } from './shared.mjs';

const fieldLabel = (f, forId) =>
  `<label class="uc-label"${forId ? ` for="${esc(forId)}"` : ''}>${esc(f.label)}${f.required ? '' : ' <span class="uc-optional">optional</span>'}</label>`;

function control(f, fid, helpId) {
  const described = f.help ? ` aria-describedby="${esc(helpId)}"` : '';
  const required = f.required ? ' required' : '';
  const common = `id="${esc(fid)}" name="${esc(f.id)}"${required}${described}`;
  const text = (attr) => (attr == null ? '' : ` ${attr}`);
  switch (f.type) {
    case 'text':
      return `<input class="uc-input" type="${esc(f.inputType ?? 'text')}" ${common}${text(f.placeholder && `placeholder="${esc(f.placeholder)}"`)}${text(f.maxLength && `maxlength="${f.maxLength}"`)} value="${esc(f.default ?? '')}">`;
    case 'textarea':
      return `<textarea class="uc-input" rows="${f.rows ?? 3}" ${common}${text(f.placeholder && `placeholder="${esc(f.placeholder)}"`)}${text(f.maxLength && `maxlength="${f.maxLength}"`)}>${esc(f.default ?? '')}</textarea>`;
    case 'select':
      return join(
        `<div class="uc-select"><select class="uc-input" ${common}>`,
        `<option value=""${f.default ? '' : ' selected'}${f.required ? ' disabled' : ''}>${f.required ? 'Choose…' : 'None'}</option>`,
        f.options.map((o) => `<option value="${esc(o.value)}"${o.value === f.default ? ' selected' : ''}>${esc(o.label)}</option>`),
        '</select></div>',
      );
  }
}

function choiceGroup(f, fid, helpId) {
  const multi = f.type === 'checkbox';
  const described = f.help ? ` aria-describedby="${esc(helpId)}"` : '';
  const min = multi && f.required ? ` data-uc-min="1" data-uc-min-message="Select at least one option."` : '';
  const defaults = [].concat(f.default ?? []);
  const options = f.options.map((o, i) => {
    const checked = defaults.includes(o.value) ? ' checked' : '';
    const required = !multi && f.required ? ' required' : '';
    const multiAttr = multi ? ' data-uc-multi="true"' : '';
    return `<label class="uc-option"><input type="${multi ? 'checkbox' : 'radio'}" id="${esc(`${fid}~${i}`)}" name="${esc(f.id)}" value="${esc(o.value)}"${checked}${required}${multiAttr}><span>${esc(o.label)}</span></label>`;
  });
  return join(
    `<fieldset class="uc-field uc-group"${described}${min}>`,
    `<legend class="uc-label">${esc(f.label)}${f.required ? '' : ' <span class="uc-optional">optional</span>'}</legend>`,
    `<div class="uc-options">${options.join('')}</div>`,
    f.help && `<p class="uc-help" id="${esc(helpId)}">${esc(f.help)}</p>`,
    '</fieldset>',
  );
}

function singleCheckbox(f, fid, helpId) {
  const described = f.help ? ` aria-describedby="${esc(helpId)}"` : '';
  return join(
    '<div class="uc-field">',
    `<label class="uc-option uc-option-solo"><input type="checkbox" id="${esc(fid)}" name="${esc(f.id)}" value="true"${f.default ? ' checked' : ''}${f.required ? ' required' : ''}${described}><span>${esc(f.label)}</span></label>`,
    f.help && `<p class="uc-help" id="${esc(helpId)}">${esc(f.help)}</p>`,
    '</div>',
  );
}

/** Multi-field form. Sends every field in one `values` object keyed by field id. */
export function render(card, ctx) {
  const fields = card.fields.map((f) => {
    const fid = `${card.id}~f~${f.id}`; // "~" never appears in ids, so generated DOM ids stay unique
    const helpId = `${fid}~help`;
    if (f.type === 'radio' || (f.type === 'checkbox' && f.options)) return choiceGroup(f, fid, helpId);
    if (f.type === 'checkbox') return singleCheckbox(f, fid, helpId);
    return join('<div class="uc-field">', fieldLabel(f, fid), control(f, fid, helpId), f.help && `<p class="uc-help" id="${esc(helpId)}">${esc(f.help)}</p>`, '</div>');
  });
  return shell(card, ctx, `<div class="uc-fields">${fields.join('')}</div>`, {
    interactive: true,
    footer: footer(ctx, submitButton(card.submitLabel ?? 'Send')),
  });
}
