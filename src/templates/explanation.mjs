import { esc, ICONS, inline, join } from '../html.mjs';
import { paragraphs, shell } from './shared.mjs';

function steps(card) {
  const items = card.steps.map((s, i) =>
    join(
      '<li class="uc-step">',
      `<span class="uc-step-num" aria-hidden="true">${i + 1}</span>`,
      `<div class="uc-step-body"><p class="uc-step-title">${inline(s.title)}</p>`,
      s.detail && `<p class="uc-step-detail">${inline(s.detail)}</p>`,
      s.more && `<details class="uc-more"><summary>More</summary>${paragraphs(s.more, 'uc-more-text')}</details>`,
      '</div></li>',
    ),
  );
  return `<ol class="uc-steps" role="list">${items.join('')}</ol>`;
}

function flow(card) {
  const nodes = card.nodes.map((n, i) =>
    join(
      i > 0 && `<li class="uc-flow-arrow" aria-hidden="true">${ICONS.arrow}</li>`,
      `<li class="uc-flow-node"><span class="uc-flow-num" aria-hidden="true">${i + 1}</span><p class="uc-flow-label">${inline(n.label)}</p>`,
      n.detail && `<p class="uc-flow-detail">${inline(n.detail)}</p>`,
      '</li>',
    ),
  );
  return `<ol class="uc-flow" role="list">${nodes.join('')}</ol>`;
}

const POINT = { pro: ['+', 'Pro'], con: ['−', 'Con'], neutral: ['·', ''] };

function comparison(card) {
  const cols = card.columns.map((c) => {
    const points = c.points.map((p) => {
      const { text, kind = 'neutral' } = typeof p === 'string' ? { text: p } : p;
      const [mark, label] = POINT[kind];
      return `<li class="uc-point" data-kind="${kind}"><span class="uc-point-mark" aria-hidden="true">${mark}</span>${label ? `<span class="uc-sr">${label}: </span>` : ''}<span>${inline(text)}</span></li>`;
    });
    return join(
      `<section class="uc-col"${c.recommended ? ' data-recommended' : ''}>`,
      `<div class="uc-col-head"><h3 class="uc-col-title">${inline(c.title)}</h3>`,
      c.recommended && `<span class="uc-badge">${ICONS.star}Recommended</span>`,
      '</div>',
      c.summary && `<p class="uc-col-summary">${inline(c.summary)}</p>`,
      `<ul class="uc-points" role="list">${points.join('')}</ul>`,
      '</section>',
    );
  });
  return `<div class="uc-compare" data-cols="${card.columns.length}">${cols.join('')}</div>`;
}

const VARIANTS = { steps, flow, comparison };

/** Visual explainer: numbered steps, a simple flow, or a side-by-side comparison. Read-only. */
export function render(card, ctx) {
  const reveal = card.reveal && `<details class="uc-reveal"><summary>${esc(card.reveal.label)}</summary>${paragraphs(card.reveal.body, 'uc-more-text')}</details>`;
  return shell(card, ctx, join(VARIANTS[card.variant](card), reveal));
}
