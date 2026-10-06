import { esc, ICONS, inline, join, safeUrl } from '../html.mjs';
import { shell } from './shared.mjs';

const ARROWS = { up: ICONS.up, down: ICONS.down, flat: '' };

/** Prominent value with optional delta, supporting line, and link CTA. Read-only. */
export function render(card, ctx) {
  const delta = card.delta &&
    `<span class="uc-delta" data-tone="${esc(card.delta.tone ?? (card.delta.direction === 'down' ? 'danger' : card.delta.direction === 'up' ? 'success' : 'neutral'))}">${ARROWS[card.delta.direction ?? 'flat']}${esc(card.delta.text)}</span>`;
  const href = card.cta && safeUrl(card.cta.href);
  const content = join(
    '<div class="uc-hero">',
    `<p class="uc-value">${esc(card.value)}</p>`,
    (card.label || delta) && `<p class="uc-value-label">${card.label ? `<span>${inline(card.label)}</span>` : ''}${delta || ''}</p>`,
    '</div>',
    card.supporting && `<p class="uc-supporting">${inline(card.supporting)}</p>`,
    href && `<div class="uc-footer uc-footer-cta"><a class="uc-btn uc-btn-secondary" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(card.cta.label)}${ICONS.arrow}</a></div>`,
  );
  return shell(card, ctx, content);
}
