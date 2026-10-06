import { esc, ICONS, inline, join, link } from '../html.mjs';
import { facts, shell } from './shared.mjs';

/**
 * One recorded walkthrough: native player (no autoplay, nothing preloaded), a full-screen button, caption, chapters,
 * fallback link. The player sits in a popover "theater" that client/media.mjs opens in-frame when the host page
 * blocks real full screen; the <video> element itself never moves, so playback continues. Read-only.
 */
export function render(card, ctx) {
  const video = ctx.videos.get(card.src);
  const poster = card.poster && ctx.images.get(card.poster);
  const caption = card.caption && `<figcaption class="uc-caption" id="${esc(card.id)}~caption">${inline(card.caption)}</figcaption>`;
  // Remote videos fall back to their own URL; inlined local videos only link out when `href` is given.
  const href = card.href ?? video?.href;
  const fallback = link(href, card.linkLabel ?? 'Open video');
  const player = video?.url
    ? join(
        `<video controls preload="none" playsinline aria-labelledby="${esc(card.id)}~title"`,
        caption && ` aria-describedby="${esc(card.id)}~caption"`,
        poster?.dataUri && ` poster="${esc(poster.dataUri)}"`,
        `><source src="${esc(video.url)}"${video.type ? ` type="${esc(video.type)}"` : ''}>`,
        `<p class="uc-asset-note">This browser can't play the video here.${fallback ? ` ${fallback}` : ''}</p></video>`,
      )
    : '';
  const frame = `<div class="uc-player" data-aspect="${esc(card.aspect ?? '16:9')}"${video?.url ? '' : ' data-missing'}>${player}<span class="uc-missing">${ICONS.play}<span>Video unavailable</span></span></div>`;
  const chapters = card.chapters &&
    `<ol class="uc-chapters" role="list" aria-label="Chapters">${card.chapters
      .map((c) => `<li class="uc-chapter"><time class="uc-chapter-time">${esc(c.time)}</time><span>${inline(c.label)}</span></li>`)
      .join('')}</ol>`;
  const content = join(
    `<figure class="uc-video"${video?.url ? ' data-uc-video' : ''}>`,
    video?.url
      ? join(
          '<div class="uc-theater" data-uc-theater popover="manual">',
          frame,
          '<div class="uc-theater-bar">',
          '<p class="uc-theater-note" data-uc-theater-note></p>',
          fallback,
          `<button type="button" class="uc-btn uc-btn-secondary uc-btn-sm" data-uc-theater-close>${ICONS.x}Close</button>`,
          '</div></div>',
          `<div class="uc-video-tools"><button type="button" class="uc-btn uc-btn-secondary uc-btn-sm" data-uc-fullscreen>${ICONS.fullscreen}Full screen<span class="uc-sr"> video</span></button></div>`,
        )
      : frame,
    card.poster && !poster?.dataUri && video?.url && '<p class="uc-asset-note">Poster image unavailable.</p>',
    caption,
    '</figure>',
    chapters,
    facts(card.facts),
    fallback && `<div class="uc-footer uc-footer-cta">${fallback}</div>`,
  );
  return shell(card, ctx, content);
}
