import { esc, ICONS, inline, join, link } from '../html.mjs';
import { facts, shell } from './shared.mjs';

const PAIR = ['Before', 'After'];

/** 1–6 captioned screenshots as a gallery or a before/after pair. Images arrive pre-resolved as data URIs. Read-only. */
export function render(card, ctx) {
  const layout = card.layout ?? 'gallery';
  const shots = card.shots.map((s, i) => {
    const image = ctx.images.get(s.src);
    const label = s.label ?? (layout === 'before-after' ? PAIR[i] : '');
    return join(
      '<figure class="uc-shot">',
      `<div class="uc-shot-media"${image?.dataUri ? '' : ' data-missing'}>`,
      image?.dataUri && `<img src="${esc(image.dataUri)}" alt="${esc(s.alt)}" decoding="async">`,
      `<span class="uc-missing">${ICONS.image}<span>Screenshot unavailable</span><span class="uc-sr">: ${esc(s.alt)}</span></span>`,
      label && `<span class="uc-shot-label">${esc(label)}</span>`,
      '</div>',
      (s.caption || s.href) && join(
        '<figcaption class="uc-caption">',
        s.caption && `<span>${inline(s.caption)}</span>`,
        link(s.href, s.linkLabel ?? 'Open original'),
        '</figcaption>',
      ),
      '</figure>',
    );
  });
  return shell(card, ctx, join(`<div class="uc-shots" data-layout="${layout}" data-count="${card.shots.length}">${shots.join('')}</div>`, facts(card.facts)));
}
