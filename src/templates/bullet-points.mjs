import { ICONS, inline, join, link } from '../html.mjs';
import { shell } from './shared.mjs';

const STATUS = {
  done: { icon: ICONS.check, label: 'Done' },
  progress: { icon: ICONS.progress, label: 'In progress' },
  blocked: { icon: ICONS.alert, label: 'Blocked' },
  next: { icon: ICONS.arrow, label: 'Next' },
  info: { icon: ICONS.dot, label: 'Note' },
};

/** Informational bullets; read-only, nothing is sent. */
export function render(card, ctx) {
  const items = card.items.map((item) => {
    const status = STATUS[item.status ?? 'info'];
    return join(
      `<li class="uc-bullet" data-status="${item.status ?? 'info'}">`,
      `<span class="uc-bullet-icon">${status.icon}<span class="uc-sr">${status.label}: </span></span>`,
      `<div class="uc-bullet-text"><p class="uc-bullet-main">${inline(item.text)}</p>`,
      item.detail && `<p class="uc-bullet-detail">${inline(item.detail)}</p>`,
      '</div>',
      link(item.href, item.linkLabel ?? 'Open', 'uc-link uc-row-link'),
      '</li>',
    );
  });
  const foot = card.footer ? `<p class="uc-foot-note">${inline(card.footer)}</p>` : '';
  return shell(card, ctx, `<ul class="uc-bullets" role="list">${items.join('')}</ul>${foot}`);
}
