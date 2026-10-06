import { esc, inline, join } from '../html.mjs';

const DEFAULT_EYEBROW = {
  'yes-no': 'Decision',
  form: 'Details needed',
  checklist: 'Checklist',
  'bullet-points': 'Update',
  'big-text': 'Result',
  explanation: 'How it works',
  'image-choice': 'Pick one',
  'app-name-choice': 'Pick a name',
};

/** Paragraphs from text separated by blank lines; `code` spans allowed. */
export const paragraphs = (text, className) =>
  String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="${className}">${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

function header(card, interactive) {
  const index = card.index ? `<span class="uc-index">${String(card.index).padStart(2, '0')}</span>` : '';
  const flag = interactive ? '<span class="uc-flag">Needs you</span>' : '';
  return join(
    '<header class="uc-head">',
    `<div class="uc-meta">${index}<span class="uc-eyebrow"><span class="uc-pip" aria-hidden="true"></span>${esc(card.eyebrow ?? DEFAULT_EYEBROW[card.type])}</span>${flag}</div>`,
    `<h2 class="uc-title" id="${esc(card.id)}~title">${inline(card.title)}</h2>`,
    paragraphs(card.body, 'uc-body'),
    '</header>',
  );
}

/** Outer <article> for every card. Interactive cards wrap their content in a <form> used only for validation. */
export function shell(card, ctx, content, { interactive = false, footer = '' } = {}) {
  const attrs = join(
    ` class="uc-card uc-${card.type}"`,
    ` data-tone="${esc(card.tone ?? 'neutral')}"`,
    ` aria-labelledby="${esc(card.id)}~title"`,
    interactive && ` data-uc-card="${esc(card.id)}" data-uc-type="${esc(card.type)}" data-uc-state="idle"`,
  );
  const inner = interactive
    ? `<form class="uc-form" autocomplete="off">${content}${noteField(card)}${footer}</form>`
    : `${content}${footer}`;
  return `<article${attrs}>${header(card, interactive)}<div class="uc-content">${inner}</div></article>`;
}

function noteField(card) {
  if (!card.allowNote) return '';
  const fid = `${card.id}~note`;
  return join(
    '<div class="uc-field uc-note">',
    `<label class="uc-label" for="${esc(fid)}">${esc(card.noteLabel ?? 'Note')} <span class="uc-optional">optional</span></label>`,
    `<textarea class="uc-input" id="${esc(fid)}" name="note" rows="2" maxlength="1000" placeholder="${esc(card.notePlaceholder ?? 'Anything the agent should know')}"></textarea>`,
    '</div>',
  );
}

/**
 * Footer with live status and action buttons.
 * @param {{ live: boolean }} ctx
 * @param {string} buttons
 */
export function footer(ctx, buttons) {
  const hint = ctx.live ? 'Your reply goes to the agent in this chat.' : 'Preview · replies stay on this page.';
  return join(
    '<div class="uc-footer">',
    `<p class="uc-status" role="status" aria-live="polite" data-uc-status data-hint="${esc(hint)}"></p>`,
    '<div class="uc-actions">',
    '<button type="button" class="uc-btn uc-btn-ghost" data-uc-reset hidden>Reset</button>',
    buttons,
    '</div></div>',
  );
}

export const submitButton = (label) =>
  `<button type="button" class="uc-btn uc-btn-primary" data-uc-action="submit" data-uc-primary>${esc(label)}</button>`;
