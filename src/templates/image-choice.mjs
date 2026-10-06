import { esc, ICONS, join } from '../html.mjs';
import { footer, shell, submitButton, viewButton } from './shared.mjs';

/**
 * Pick one image. Images arrive pre-resolved as data URIs (or a missing marker) from the renderer.
 * The image opens a larger preview; only the radio row below it (caption or "Select") picks the option.
 */
export function render(card, ctx) {
  const tiles = card.options.map((o, i) => {
    const fid = `${card.id}~opt~${i}`;
    const image = ctx.images.get(o.src);
    const label = o.caption ?? o.alt;
    const media = join(
      `<span class="uc-media" data-uc-media${image?.dataUri ? '' : ' data-missing'}>`,
      image?.dataUri && `<img data-uc-img src="${esc(image.dataUri)}" alt="${esc(o.alt)}" decoding="async">`,
      `<span class="uc-missing">${ICONS.image}<span>Image unavailable</span><span class="uc-sr">: ${esc(o.alt)}</span></span></span>`,
    );
    return join(
      '<div class="uc-tile" data-uc-item>',
      image?.dataUri ? viewButton(o.alt, media) : media,
      `<label class="uc-tile-pick" for="${esc(fid)}">`,
      `<input type="radio" id="${esc(fid)}" name="choice" value="${esc(o.id)}" data-uc-label="${esc(label)}" required>`,
      '<span class="uc-radio" aria-hidden="true"></span>',
      `<span class="uc-tile-caption" data-uc-caption>${o.caption ? esc(o.caption) : `<span aria-hidden="true">Select</span><span class="uc-sr">${esc(o.alt)}</span>`}</span>`,
      '</label></div>',
    );
  });
  return shell(
    card,
    ctx,
    `<fieldset class="uc-tiles" data-aspect="${esc(card.aspect ?? '4:3')}" data-surface="${esc(card.imageBackground ?? 'light')}"><legend class="uc-sr">${esc(card.title)}</legend>${tiles.join('')}</fieldset>`,
    { interactive: true, footer: footer(ctx, submitButton(card.submitLabel ?? 'Send choice')) },
  );
}
