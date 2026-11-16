import { ICONS, inline, join, link } from '../html.mjs';
import { shell } from './shared.mjs';

const STATUS = { 'needs-you': 'Needs you', blocked: 'Blocked', proposed: 'Proposed', fixing: 'Fixing', solved: 'Solved' };

/** One line per problem: status dot, problem → solution, optional ask. Read-only; nothing is sent. */
export function render(card, ctx) {
  const rows = card.items.map((item) => {
    const status = item.status ?? 'proposed';
    return join(
      `<li class="uc-ps" data-status="${status}">`,
      `<span class="uc-ps-dot" title="${STATUS[status]}"><span class="uc-sr">${STATUS[status]}: </span></span>`,
      `<p class="uc-ps-problem">${inline(item.problem)}</p>`,
      `<span class="uc-ps-arrow" aria-hidden="true">${ICONS.arrow}</span>`,
      `<p class="uc-ps-solution"><span class="uc-sr">Solution: </span>${inline(item.solution)}${link(item.href, item.linkLabel ?? 'Open', 'uc-link uc-ps-link')}</p>`,
      item.ask && `<p class="uc-ps-ask"><b>You:</b> ${inline(item.ask)}</p>`,
      '</li>',
    );
  });
  const foot = card.footer ? `<p class="uc-foot-note">${inline(card.footer)}</p>` : '';
  return shell(card, ctx, `<ul class="uc-ps-list" role="list">${rows.join('')}</ul>${foot}`);
}
