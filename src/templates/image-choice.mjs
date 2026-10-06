import { esc, ICONS, join } from '../html.mjs';
import { footer, shell, submitButton } from './shared.mjs';

/** Pick one image. Images arrive pre-resolved as data URIs (or a missing marker) from the renderer. */
export function render(card, ctx) {
  const tiles = card.options.map((o, i) => {
    const fid = `${card.id}~opt~${i}`;
    const image = ctx.images.get(o.src);
    const label = o.caption ?? o.alt;
    const media = image?.dataUri
      ? `<img data-uc-img src="${esc(image.dataUri)}" alt="${esc(o.alt)}" decoding="async">`
      : '';
    return join(
      `<label class="uc-tile" for="${esc(fid)}">`,
      `<input type="radio" id="${esc(fid)}" name="choice" value="${esc(o.id)}" data-uc-label="${esc(label)}" required>`,
      `<span class="uc-media" data-uc-media${image?.dataUri ? '' : ' data-missing'}>${media}<span class="uc-missing">${ICONS.image}<span>Image unavailable</span><span class="uc-sr">: ${esc(o.alt)}</span></span></span>`,
      `<span class="uc-tile-caption">${o.caption ? esc(o.caption) : `<span class="uc-sr">${esc(o.alt)}</span>`}</span>`,
      `<span class="uc-tick" aria-hidden="true">${ICONS.check}</span>`,
      '</label>',
    );
  });
  return shell(
    card,
    ctx,
    `<fieldset class="uc-tiles" data-aspect="${esc(card.aspect ?? '4:3')}" data-surface="${esc(card.imageBackground ?? 'light')}"><legend class="uc-sr">${esc(card.title)}</legend>${tiles.join('')}</fieldset>`,
    { interactive: true, footer: footer(ctx, submitButton(card.submitLabel ?? 'Send choice')) },
  );
}
