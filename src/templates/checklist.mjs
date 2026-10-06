import { esc, inline, join, link } from '../html.mjs';
import { footer, shell, submitButton } from './shared.mjs';

/** Selectable checklist. Sends `{ checked: [ids], unchecked: [ids] }`. */
export function render(card, ctx) {
  const total = card.items.length;
  const done = card.items.filter((i) => i.checked).length;
  const meter = join(
    '<div class="uc-progress" data-uc-progress>',
    `<span class="uc-progress-label" data-uc-progress-label>${done === total ? `All ${done} done` : `${done} of ${total} done`}</span>`,
    '<span class="uc-segments" aria-hidden="true">',
    card.items.map((_, i) => `<span class="uc-segment" data-uc-segment${i < done ? ' data-on' : ''}></span>`),
    '</span></div>',
  );
  const min = card.minChecked ? ` data-uc-min="${card.minChecked}" data-uc-min-message="Check at least ${card.minChecked} item${card.minChecked > 1 ? 's' : ''}."` : '';
  const items = card.items.map((item, i) => {
    const fid = `${card.id}~item~${i}`;
    return join(
      '<li class="uc-check-row">',
      `<label class="uc-check" for="${esc(fid)}">`,
      `<input type="checkbox" id="${esc(fid)}" name="checked" value="${esc(item.id)}" data-uc-multi="true"${item.checked ? ' checked' : ''}>`,
      '',
      `<span class="uc-check-text"><span class="uc-check-label">${inline(item.label)}</span>${item.detail ? `<span class="uc-check-detail">${inline(item.detail)}</span>` : ''}</span>`,
      '</label>',
      link(item.href, item.linkLabel ?? 'Open', 'uc-link uc-row-link'),
      '</li>',
    );
  });
  return shell(card, ctx, `${meter}<ul class="uc-checklist" role="list"${min}>${items.join('')}</ul>`, {
    interactive: true,
    footer: footer(ctx, submitButton(card.submitLabel ?? 'Send checklist')),
  });
}
