import { ICONS, inline, join, link } from '../html.mjs';
import { shell } from './shared.mjs';

export const STATUS = {
  'needs-you': 'Needs you',
  blocked: 'Blocked',
  proposed: 'Proposed',
  fixing: 'Fixing',
  solved: 'Solved',
};

/** Summary chips for 2+ items, most urgent first: "1 needs you · 2 solved". */
function summary(items) {
  if (items.length < 2) return '';
  const counts = Object.keys(STATUS)
    .map((s) => [s, items.filter((i) => (i.status ?? 'proposed') === s).length])
    .filter(([, n]) => n);
  return `<p class="uc-ps-summary">${counts.map(([s, n]) => `<span class="uc-ps-chip" data-status="${s}">${n} ${STATUS[s].toLowerCase()}</span>`).join('')}</p>`;
}

/** Compact problem → solution rows; read-only, nothing is sent. Pair with an input card when Brahim must answer. */
export function render(card, ctx) {
  const many = card.items.length > 1;
  const rows = card.items.map((item, i) => {
    const status = item.status ?? 'proposed';
    return join(
      `<li class="uc-ps" data-status="${status}">`,
      '<div class="uc-ps-top">',
      many && `<span class="uc-ps-num">${i + 1}</span>`,
      item.label && `<p class="uc-ps-label">${inline(item.label)}</p>`,
      `<span class="uc-ps-badge">${STATUS[status]}</span>`,
      '</div>',
      '<div class="uc-ps-pair">',
      `<div class="uc-ps-cell uc-ps-problem"><span class="uc-ps-tag">Problem</span><p>${inline(item.problem)}</p></div>`,
      `<span class="uc-ps-arrow" aria-hidden="true">${ICONS.arrow}</span>`,
      `<div class="uc-ps-cell uc-ps-solution"><span class="uc-ps-tag">Solution</span><p>${inline(item.solution)}</p></div>`,
      '</div>',
      item.ask && `<p class="uc-ps-ask"><span class="uc-ps-tag">You</span>${inline(item.ask)}</p>`,
      link(item.href, item.linkLabel ?? 'Open', 'uc-link uc-ps-link'),
      '</li>',
    );
  });
  const foot = card.footer ? `<p class="uc-foot-note">${inline(card.footer)}</p>` : '';
  return shell(card, ctx, `${summary(card.items)}<ol class="uc-ps-list" role="list">${rows.join('')}</ol>${foot}`);
}
