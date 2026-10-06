import { esc, ICONS } from '../html.mjs';
import { footer, shell } from './shared.mjs';

/** Two-button decision. Clicking a button sends `{ answer: "yes" | "no" }` immediately. */
export function render(card, ctx) {
  const yes = card.yesLabel ?? 'Yes';
  const no = card.noLabel ?? 'No';
  const buttons =
    `<button type="button" class="uc-btn uc-btn-secondary" data-uc-action="answer" data-uc-value="no" data-uc-label="${esc(no)}">${ICONS.x}${esc(no)}</button>` +
    `<button type="button" class="uc-btn ${card.destructive ? 'uc-btn-danger' : 'uc-btn-primary'}" data-uc-action="answer" data-uc-value="yes" data-uc-label="${esc(yes)}">${ICONS.check}${esc(yes)}</button>`;
  return shell(card, ctx, '', { interactive: true, footer: footer(ctx, buttons) });
}
