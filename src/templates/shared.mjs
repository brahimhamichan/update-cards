import { esc, ICONS, inline, join } from '../html.mjs';

const DEFAULT_EYEBROW = {
  'yes-no': 'Decision',
  form: 'Details needed',
  checklist: 'Checklist',
  'bullet-points': 'Update',
  'big-text': 'Result',
  explanation: 'How it works',
  'image-choice': 'Pick one',
  'app-name-choice': 'Pick a name',
  'video-walkthrough': 'Walkthrough',
  'screenshot-proof': 'Proof',
};

/** Small label/value facts (viewport, theme, commit…) shown under proof media. */
export const facts = (list) =>
  list?.length
    ? `<dl class="uc-facts">${list.map((f) => `<div class="uc-fact"><dt>${esc(f.label)}</dt><dd>${inline(f.value)}</dd></div>`).join('')}</dl>`
    : '';

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

/** Wrap a present image in a preview button that opens the card's lightbox (see client/media.mjs). Missing images stay plain. */
export const viewButton = (alt, media) =>
  `<button type="button" class="uc-view" data-uc-zoom aria-haspopup="dialog" aria-label="View larger: ${esc(alt)}">${media}<span class="uc-view-hint" aria-hidden="true">${ICONS.expand}</span></button>`;

/** The one image viewer per document; client/media.mjs fills it from the clicked card's preview buttons. */
export const LIGHTBOX = join(
  '<dialog class="uc-lightbox" data-uc-lightbox aria-labelledby="uc-lb-title">',
  '<div class="uc-lb-frame" data-uc-lb-frame>',
  '<div class="uc-lb-bar">',
  '<p class="uc-lb-title" id="uc-lb-title"><span data-uc-lb-title></span><span class="uc-lb-count" data-uc-lb-count></span></p>',
  '<div class="uc-lb-tools">',
  `<button type="button" class="uc-lb-btn" data-uc-lb="zoom" aria-pressed="false">${ICONS.zoom}<span>Zoom</span></button>`,
  `<button type="button" class="uc-lb-btn" data-uc-lb="fullscreen" aria-pressed="false">${ICONS.fullscreen}<span>Full screen</span></button>`,
  `<button type="button" class="uc-lb-btn" data-uc-lb="close" aria-label="Close viewer">${ICONS.x}</button>`,
  '</div></div>',
  '<div class="uc-lb-stage" data-uc-lb-stage data-zoom="fit"><img data-uc-lb-img alt=""></div>',
  `<button type="button" class="uc-lb-nav" data-uc-lb="prev" aria-label="Previous image">${ICONS.prev}</button>`,
  `<button type="button" class="uc-lb-nav" data-uc-lb="next" aria-label="Next image">${ICONS.next}</button>`,
  '<div class="uc-lb-foot">',
  '<p class="uc-lb-caption" data-uc-lb-caption aria-live="polite"></p>',
  '<p class="uc-lb-note" data-uc-lb-note role="status"></p>',
  `<a class="uc-link" data-uc-lb-original target="_blank" rel="noopener noreferrer" hidden>Open original${ICONS.external}</a>`,
  '</div></div></dialog>',
);
