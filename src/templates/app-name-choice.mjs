import { esc, ICONS, inline, join } from '../html.mjs';
import { footer, shell, submitButton } from './shared.mjs';

/** Pick one name from a shortlist; sends `{ choice: id }`. */
export function render(card, ctx) {
  const options = card.options.map((o, i) => {
    const fid = `${card.id}~opt~${i}`;
    return join(
      `<label class="uc-name" for="${esc(fid)}"${o.recommended ? ' data-recommended' : ''}>`,
      `<input type="radio" id="${esc(fid)}" name="choice" value="${esc(o.id)}" data-uc-label="${esc(o.name)}" required>`,
      '<span class="uc-name-main">',
      `<span class="uc-name-word">${esc(o.name)}</span>`,
      o.recommended && `<span class="uc-badge">${ICONS.star}Recommended</span>`,
      '</span>',
      o.tagline && `<span class="uc-name-tagline">${inline(o.tagline)}</span>`,
      o.rationale && `<span class="uc-name-why">${inline(o.rationale)}</span>`,
      `<span class="uc-tick" aria-hidden="true">${ICONS.check}</span>`,
      '</label>',
    );
  });
  return shell(card, ctx, `<fieldset class="uc-names"><legend class="uc-sr">${esc(card.title)}</legend>${options.join('')}</fieldset>`, {
    interactive: true,
    footer: footer(ctx, submitButton(card.submitLabel ?? 'Send choice')),
  });
}
