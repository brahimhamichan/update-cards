// Media runtime: a per-card image lightbox and a video full-screen button for image-choice, screenshot-proof, and
// video-walkthrough cards. Independent of the response runtime: it reads no config, sends nothing, and never
// selects or submits a choice. Works inside `sandbox="allow-scripts"`.

const $ = (selector, root = document) => root.querySelector(selector);
const FULLSCREEN_BLOCKED = 'Full screen isn’t allowed where this card is shown, so the view fills the card’s frame instead.';

// ── Keep overlays in view ───────────────────────────────
// A host may size this frame to its content, so `position: fixed` would center an overlay in a frame taller than the
// screen. Fit open overlays to the part of the document that is actually visible.
const overlays = new Set();
let visible = null;
function place() {
  for (const el of overlays) {
    if (!visible || document.fullscreenElement) {
      el.style.removeProperty('top');
      el.style.removeProperty('height');
      continue;
    }
    const height = Math.min(innerHeight, Math.max(visible.height, 320));
    el.style.top = `${Math.max(0, Math.min(visible.top, innerHeight - height))}px`;
    el.style.height = `${height}px`;
  }
}
if ('IntersectionObserver' in window) {
  const threshold = Array.from({ length: 101 }, (_, i) => i / 100);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting ? entry.intersectionRect : null;
    place();
  }, { threshold }).observe(document.documentElement);
}
const showOverlay = (el) => (overlays.add(el), place());
const hideOverlay = (el) => (overlays.delete(el), el.style.removeProperty('top'), el.style.removeProperty('height'));

/** Make everything outside `el` inert (for overlays that can't be a modal <dialog>); returns the undo. */
function isolate(el) {
  const changed = [];
  for (let node = el; node.parentElement && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement.children) if (sibling !== node && !sibling.inert) changed.push(sibling);
  }
  changed.forEach((sibling) => (sibling.inert = true));
  return () => changed.forEach((sibling) => (sibling.inert = false));
}

// ── Images ──────────────────────────────────────────────
// decode() rejects for broken or undecodable images, including ones that failed before this script ran.
// A broken image shows its placeholder and stops being a preview button.
function markMissing(img) {
  img.closest('[data-uc-media]')?.setAttribute('data-missing', '');
  const button = img.closest('[data-uc-zoom]');
  if (button) button.replaceWith(...[...button.childNodes].filter((n) => !n.matches?.('.uc-view-hint')));
}
document.querySelectorAll('img[data-uc-img]').forEach((img) => img.decode().catch(() => img.naturalWidth > 0 || markMissing(img)));

const box = $('[data-uc-lightbox]');
if (box) {
  const frame = $('[data-uc-lb-frame]', box);
  const stage = $('[data-uc-lb-stage]', box);
  const view = $('[data-uc-lb-img]', box);
  const note = $('[data-uc-lb-note]', box);
  const original = $('[data-uc-lb-original]', box);
  const control = (name) => $(`[data-uc-lb="${name}"]`, box);
  let items = [];
  let index = 0;
  let opener = null;

  const setZoom = (on) => {
    if (on) {
      // Actual pixels for large screenshots; at least 2× the fitted size for small images and logos.
      const { width, height } = view.getBoundingClientRect();
      const fitted = view.naturalWidth && view.naturalHeight ? Math.min(width, (height * view.naturalWidth) / view.naturalHeight) : width;
      view.style.width = `${Math.round(Math.max(view.naturalWidth, fitted * 2))}px`;
    } else view.style.removeProperty('width');
    stage.dataset.zoom = on ? 'actual' : 'fit';
    control('zoom').setAttribute('aria-pressed', String(on));
    stage.scrollTo((stage.scrollWidth - stage.clientWidth) / 2, (stage.scrollHeight - stage.clientHeight) / 2);
  };

  const show = (i) => {
    index = Math.max(0, Math.min(items.length - 1, i));
    const button = items[index];
    const img = $('img', button);
    const item = button.closest('[data-uc-item]') ?? button;
    const parts = [$('[data-uc-shot-label]', item)?.textContent, $('[data-uc-caption]', item)?.textContent.trim()];
    setZoom(false);
    view.src = img.currentSrc || img.src;
    view.alt = img.alt;
    view.dataset.surface = button.closest('[data-surface]')?.dataset.surface ?? 'none'; // logos keep their light/dark well
    $('[data-uc-lb-caption]', box).textContent = parts.filter(Boolean).join(' · ') || img.alt;
    $('[data-uc-lb-count]', box).textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
    const href = $('figcaption a.uc-link[href]', item)?.href;
    original.hidden = !href;
    if (href) original.href = href;
    else original.removeAttribute('href');
    note.textContent = '';
    for (const [name, end] of [['prev', 0], ['next', items.length - 1]]) {
      control(name).hidden = items.length < 2;
      control(name).disabled = index === end;
    }
    // Keep keyboard focus on a usable control when an arrow button disables itself at either end.
    if (document.activeElement?.disabled) control(index === 0 ? 'next' : 'prev').focus();
  };

  const open = (button) => {
    const card = button.closest('.uc-card') ?? document;
    items = [...card.querySelectorAll('[data-uc-zoom]')]; // one gallery per card
    opener = button;
    $('[data-uc-lb-title]', box).textContent = $('.uc-title', card)?.textContent ?? '';
    button.focus(); // Safari doesn't focus clicked buttons; the dialog restores focus to whatever had it before
    box.showModal();
    show(items.indexOf(button));
    showOverlay(box);
    control('close').focus();
  };

  const fullscreen = async () => {
    if (document.fullscreenElement) return document.exitFullscreen().catch(() => {});
    try {
      if (!document.fullscreenEnabled || !frame.requestFullscreen) throw new Error('blocked');
      await frame.requestFullscreen(); // a descendant of the modal dialog: it stacks above it while full screen
    } catch {
      note.textContent = FULLSCREEN_BLOCKED + (original.hidden ? '' : ' Open the original for the full-size file.');
    }
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-uc-zoom]');
    if (button && !box.open) open(button);
  });
  box.addEventListener('click', (event) => {
    const name = event.target.closest('[data-uc-lb]')?.dataset.ucLb;
    if (name === 'close' || event.target === stage || event.target === box) box.close();
    else if (name === 'prev' || name === 'next') show(index + (name === 'next' ? 1 : -1));
    else if (name === 'zoom' || event.target === view) setZoom(stage.dataset.zoom !== 'actual');
    else if (name === 'fullscreen') fullscreen();
  });
  box.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      box.close();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  box.addEventListener('close', () => {
    if (document.fullscreenElement && box.contains(document.fullscreenElement)) document.exitFullscreen().catch(() => {});
    hideOverlay(box);
    view.removeAttribute('src');
    opener?.focus();
    opener = null;
  });
  document.addEventListener('fullscreenchange', () => {
    control('fullscreen').setAttribute('aria-pressed', String(document.fullscreenElement === frame));
    place();
  });
}

// ── Video ───────────────────────────────────────────────
// Native full screen on the <video> itself (or iOS's webkitEnterFullscreen), requested synchronously inside the
// click. When the host frame doesn't allow it, the existing player expands within the frame (a top-layer popover;
// the element never moves, so playback and position continue) and says so honestly.
for (const button of document.querySelectorAll('[data-uc-fullscreen]')) {
  const figure = button.closest('[data-uc-video]');
  const video = $('video', figure);
  const theater = $('[data-uc-theater]', figure);
  let undo = null;

  const closeTheater = () => {
    if (!undo) return;
    theater.hidePopover();
    theater.removeAttribute('role');
    theater.removeAttribute('aria-modal');
    theater.removeAttribute('aria-label');
    hideOverlay(theater);
    undo();
    undo = null;
    button.focus();
  };
  const openTheater = () => {
    if (undo || !theater.showPopover) return;
    $('[data-uc-theater-note]', theater).textContent = FULLSCREEN_BLOCKED;
    theater.setAttribute('role', 'dialog');
    theater.setAttribute('aria-modal', 'true');
    theater.setAttribute('aria-label', button.closest('.uc-card')?.querySelector('.uc-title')?.textContent || 'Video');
    theater.showPopover();
    undo = isolate(theater);
    showOverlay(theater);
    $('[data-uc-theater-close]', theater).focus();
  };

  button.addEventListener('click', () => {
    try {
      if (document.fullscreenEnabled && video.requestFullscreen) return void video.requestFullscreen().catch(openTheater);
      if (video.webkitEnterFullscreen && video.webkitSupportsFullscreen) return void video.webkitEnterFullscreen();
    } catch {
      // fall through to the in-frame player
    }
    openTheater();
  });
  $('[data-uc-theater-close]', theater).addEventListener('click', closeTheater);
  theater.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !undo) return;
    event.preventDefault();
    closeTheater();
  });
}
