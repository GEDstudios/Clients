/* ============================================================
   Pitaro Toolbox — client
   Three steps: pick a template, add your content, download.
   ============================================================ */

import {
  FONTS, SWATCHES, DEFAULT_COLOR, DEFAULT_FONT, DEFAULT_WEIGHT, TEXT_CSS,
  loadPresets, ensureFontsReady, sanitizeRichText, richTextToPlain,
  rasterizeText, rasterizeTextFallback, createVideoEl, whenVideoReady,
  makeSampler, exportMP4, exportWebMFallback, exportSupport, isVideoSrc, hasRunStyling,
  nearestWeight,
  slugify, download, fmtTime, fmtBytes, esc,
} from './engine.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ICON = {
  play:  '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M4 2.5h3.2v11H4zm4.8 0H12v11H8.8z"/></svg>',
  chev:  '<svg viewBox="0 0 16 16"><path d="M8 11L2.5 5h11z"/></svg>',
  down:  '<svg viewBox="0 0 16 16"><path d="M7 1h2v7.6l2.8-2.8 1.4 1.4L8 12.4 2.8 7.2l1.4-1.4L7 8.6zM2 13h12v2H2z"/></svg>',
  up:    '<svg viewBox="0 0 16 16"><path d="M8 1.6l5.2 5.2-1.4 1.4L9 5.4V13H7V5.4L4.2 8.2 2.8 6.8zM2 14.4h12V16H2z"/></svg>',
  check: '<svg viewBox="0 0 16 16"><path d="M6.2 12.6L1.8 8.2l1.5-1.5 2.9 2.9 6.5-6.5 1.5 1.5z"/></svg>',
  alert: '<svg viewBox="0 0 16 16"><path d="M8 1l7 13H1zm-.9 4.6v4.2h1.8V5.6zm0 5.3v1.6h1.8v-1.6z"/></svg>',
  left:  '<svg viewBox="0 0 16 16"><path d="M1 2h14v2H1zm0 4h9v2H1zm0 4h14v2H1zm0 4h9v2H1z"/></svg>',
  center:'<svg viewBox="0 0 16 16"><path d="M1 2h14v2H1zm2.5 4h9v2h-9zm-2.5 4h14v2H1zm2.5 4h9v2h-9z"/></svg>',
  right: '<svg viewBox="0 0 16 16"><path d="M1 2h14v2H1zm5 4h9v2H6zm-5 4h14v2H1zm5 4h9v2H6z"/></svg>',
};

/* ============================================================
   State
   ============================================================ */

const S = {
  presets: [],
  preset: null,
  comp: null,           /* {width,height,fps,duration} */
  scale: 1,             /* stage css scale */
  mode: null,           /* 'text' | 'media' | null */
  selected: false,
  playing: false,
  exporting: false,
  abort: null,
  media: null,          /* {kind:'image'|'video', el, url, name, size, hasAudio} */
  text: {
    html: '', dir: 'auto', align: 'center',
    font: DEFAULT_FONT, weight: DEFAULT_WEIGHT, color: DEFAULT_COLOR,
    size: 80, lineHeight: 1.15, letterSpacing: 0, shadow: false,
  },
  t: { x: 0.5, y: 0.5, scale: 1, rotation: 0, boxW: 0.72 },  /* fractions of comp */
  sound: { template: true, media: true },
  fileNameTouched: false,
  lastRange: null,
};

let bgEl = null, fgEl = null, midEl = null, stageEl = null, fitEl = null, gizmoEl = null;

/* ============================================================
   Boot
   ============================================================ */

init().catch((e) => {
  console.error(e);
  toast('Something went wrong while starting up. Reload the page to try again.');
});

async function init() {
  buildRail();
  wireSteps();
  ensureFontsReady();

  const support = exportSupport();
  if (!support.mp4) {
    const w = $('#codecWarn');
    w.classList.remove('hidden');
    w.querySelector('span').textContent = support.webm
      ? 'This browser can’t make MP4 files. You’ll get a WebM instead — for MP4, use Chrome, Edge or Safari 17+.'
      : 'This browser can’t export video. Please use Chrome, Edge or Safari 17+.';
  }

  S.presets = await loadPresets();
  renderPresets();

  const wanted = new URLSearchParams(location.search).get('t');
  const start = S.presets.find(p => p.id === wanted) || (S.presets.length === 1 ? S.presets[0] : null);
  if (start) selectPreset(start.id);

  window.addEventListener('resize', layoutStage);
  const side = $('.canvas-side');
  if ('ResizeObserver' in window) new ResizeObserver(layoutStage).observe(side);

  document.addEventListener('selectionchange', rememberSelection);
  window.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', (e) => {
    if (S.exporting) { e.preventDefault(); e.returnValue = ''; }
  });
}

/* ============================================================
   Step accordion
   ============================================================ */

function wireSteps() {
  $$('.step').forEach((step) => {
    $('.head', step).addEventListener('click', () => openStep(step.dataset.step));
  });
}

function openStep(n) {
  $$('.step').forEach((s) => {
    const on = s.dataset.step === String(n);
    s.dataset.open = on ? 'true' : 'false';
    $('.head', s).setAttribute('aria-expanded', on ? 'true' : 'false');
  });
  const el = $(`.step[data-step="${n}"]`);
  if (el && window.innerWidth <= 960) {
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 260);
  }
}

function setStepDone(n, done, summary) {
  const s = $(`.step[data-step="${n}"]`);
  if (!s) return;
  s.dataset.done = done ? 'true' : 'false';
  if (summary != null) $('.s', s).textContent = summary;
}

function enableStep(n, on) {
  const s = $(`.step[data-step="${n}"]`);
  if (s) $('.head', s).disabled = !on;
}

/* ============================================================
   Step 1 — templates
   ============================================================ */

function renderPresets() {
  const host = $('#presetList');
  if (!S.presets.length) {
    host.innerHTML =
      `<div class="hint" style="grid-column:1/-1">No templates have been published yet. ` +
      `If you look after this toolbox, open <a href="admin.html">the template builder</a> to add one.</div>`;
    return;
  }
  host.innerHTML = S.presets.map((p) => {
    const ar = p.width / p.height;
    const box = ar >= 1
      ? `width:64%;height:${64 / ar}%`
      : `height:64%;width:${64 * ar}%`;
    const thumb = p.poster
      ? `<img src="${esc(p.poster)}" alt="" loading="lazy">`
      : (isVideoSrc(p.background)
          ? `<video src="${esc(p.background)}" muted playsinline preload="metadata"></video>`
          : (p.background && !isVideoSrc(p.background)
              ? `<img src="${esc(p.background)}" alt="" loading="lazy">` : ''));
    return `<button class="preset" data-id="${esc(p.id)}" aria-pressed="false">
      <span class="thumb">${thumb}<span class="ratio" style="${box}"></span></span>
      <span class="meta">
        <span class="pname">${esc(p.name)}</span>
        <span class="pdim">${p.width}×${p.height} · ${(+p.duration).toFixed(1)}s</span>
      </span>
    </button>`;
  }).join('');

  $$('.preset', host).forEach((b) => {
    b.addEventListener('click', () => selectPreset(b.dataset.id));
    const v = $('video', b);
    if (v) {
      b.addEventListener('mouseenter', () => { v.currentTime = 0; v.loop = true; v.play().catch(() => {}); });
      b.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
    }
  });
}

async function selectPreset(id) {
  const p = S.presets.find((x) => x.id === id);
  if (!p) return;
  S.preset = p;
  S.comp = { width: p.width, height: p.height, fps: p.fps, duration: p.duration };

  $$('.preset').forEach((b) => b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false'));
  setStepDone(1, true, `${p.name} · ${p.width}×${p.height} · ${(+p.duration).toFixed(1)}s`);

  /* seed the text layer from the template's defaults */
  S.text.font   = p.text.font   || DEFAULT_FONT;
  S.text.weight = p.text.weight || DEFAULT_WEIGHT;
  S.text.color  = p.text.color  || DEFAULT_COLOR;
  S.text.align  = p.text.align  || 'center';
  S.text.lineHeight = p.text.lineHeight || 1.15;
  S.text.size   = Math.round((p.text.size || 0.075) * p.width);
  S.t = { x: p.text.x ?? .5, y: p.text.y ?? .5, scale: 1, rotation: 0, boxW: p.text.width ?? .72 };

  await buildStage(p);
  enableStep(2, true);
  applyPermissions(p);
  syncStyleControls();

  if (!S.mode) {
    openStep(2);
  } else {
    /* keep the user's content when they switch template */
    if (S.mode === 'text') mountText();
    if (S.mode === 'media') mountMedia();
    layoutStage();
  }
  refreshExportSummary();
}

/* ============================================================
   Stage
   ============================================================ */

async function buildStage(p) {
  fitEl = $('#fit');
  fitEl.classList.remove('is-empty');
  fitEl.innerHTML = '';

  stageEl = document.createElement('div');
  stageEl.className = 'stage';
  stageEl.style.width = p.width + 'px';
  stageEl.style.height = p.height + 'px';
  fitEl.appendChild(stageEl);

  /* background */
  bgEl = null;
  if (p.background && isVideoSrc(p.background)) {
    bgEl = createVideoEl([p.background, p.backgroundAlt]);
    bgEl.className = 'lay lay-bg';
    stageEl.appendChild(bgEl);
    whenVideoReady(bgEl).catch(() => toast('The template’s background video could not be loaded.'));
  } else if (p.background) {
    const img = document.createElement('img');
    img.className = 'lay lay-bg';
    img.crossOrigin = 'anonymous';
    img.src = p.background;
    stageEl.appendChild(img);
    bgEl = img;
  } else {
    stageEl.style.background = '#000';
  }

  /* middle layer host */
  const host = document.createElement('div');
  host.className = 'mid-host';
  stageEl.appendChild(host);

  /* foreground with alpha */
  fgEl = null;
  if (p.foreground) {
    fgEl = createVideoEl([p.foreground, p.foregroundAlt]);
    fgEl.className = 'lay lay-fg';
    stageEl.appendChild(fgEl);
    whenVideoReady(fgEl).catch(() => toast('The template’s overlay could not be loaded.'));
  }

  /* snap guides + gizmo */
  const sv = document.createElement('div'); sv.className = 'snapline'; sv.id = 'snapV';
  const sh = document.createElement('div'); sh.className = 'snapline'; sh.id = 'snapH';
  stageEl.append(sv, sh);

  gizmoEl = document.createElement('div');
  gizmoEl.className = 'gizmo hidden';
  gizmoEl.innerHTML =
    '<div class="frame"></div><div class="stem"></div>' +
    ['nw', 'ne', 'se', 'sw'].map(h => `<div class="h" data-h="${h}"></div>`).join('') +
    '<div class="h sq" data-h="w"></div><div class="h sq" data-h="e"></div>' +
    '<div class="h" data-h="rot"></div>';
  stageEl.appendChild(gizmoEl);

  stageEl.addEventListener('pointerdown', (e) => {
    if (e.target === stageEl || e.target.classList.contains('lay') || e.target.classList.contains('mid-host')) {
      deselect();
    }
  });
  wireGizmo();
  wireTransport();
  layoutStage();
}

function layoutStage() {
  if (!stageEl || !S.comp) return;
  const side = $('.canvas-side');
  const styles = getComputedStyle(side);
  const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
  const transport = $('#transport');
  const reserved = (transport && !transport.classList.contains('hidden') ? transport.offsetHeight + 14 : 0);

  const availW = Math.max(120, side.clientWidth - padX);
  let availH = Math.max(120, side.clientHeight - padY - reserved);
  if (window.innerWidth <= 960) availH = Math.min(availH, Math.round(window.innerHeight * 0.46));

  const s = Math.min(availW / S.comp.width, availH / S.comp.height);
  S.scale = s;
  stageEl.style.transform = `scale(${s})`;
  fitEl.style.width  = Math.round(S.comp.width * s) + 'px';
  fitEl.style.height = Math.round(S.comp.height * s) + 'px';
  stageEl.style.setProperty('--gz', (1.6 / s) + 'px');
  stageEl.style.setProperty('--hs', (11 / s) + 'px');
  const stem = $('.stem', gizmoEl);
  if (stem) stem.style.height = (26 / s) + 'px';
  if (stem) stem.style.top = (-26 / s) + 'px';
  const rot = $('[data-h="rot"]', gizmoEl);
  if (rot) rot.style.top = (-26 / s) + 'px';
  updateGizmo();
}

/* ============================================================
   Step 2 — content
   ============================================================ */

function applyPermissions(p) {
  const a = p.allow || {};
  $('#modeText').style.display   = a.text ? '' : 'none';
  $('#modeMedia').style.display  = a.upload ? '' : 'none';
  $('#fontField').style.display  = a.font ? '' : 'none';
  $('#sizeField').style.display  = a.size ? '' : 'none';
  $('#colorField').style.display = a.color ? '' : 'none';
  if (!a.text && a.upload && S.mode !== 'media') setMode('media');
  if (!a.upload && a.text && S.mode !== 'text') setMode('text');
}

function setMode(mode) {
  if (!S.preset) { toast('Pick a template first.'); return; }
  S.mode = mode;
  $$('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
  $('#textPanel').style.display  = mode === 'text' ? '' : 'none';
  $('#mediaPanel').style.display = mode === 'media' ? '' : 'none';
  if (mode === 'text') mountText(); else mountMedia();
  refreshExportSummary();
}

/* ---------- text ---------- */

function plainToHTML(txt) {
  return String(txt).split('\n')
    .map(l => `<div>${l ? esc(l) : '<br>'}</div>`).join('');
}

function mountText() {
  const host = $('.mid-host', stageEl);
  if (!host) return;
  host.innerHTML = '';

  if (!S.text.html) S.text.html = plainToHTML(S.preset.text.placeholder || 'Your message here');

  midEl = document.createElement('div');
  midEl.className = 'obj obj-text';
  midEl.setAttribute('contenteditable', 'true');
  midEl.spellcheck = false;
  midEl.setAttribute('role', 'textbox');
  midEl.setAttribute('aria-label', 'Your text on the video');
  midEl.innerHTML = S.text.html;
  host.appendChild(midEl);

  midEl.addEventListener('input', () => {
    S.text.html = sanitizeRichText(midEl.innerHTML);
    syncTextarea();
    refreshExportSummary();
    requestAnimationFrame(updateTransform);
  });
  midEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, txt);
  });
  midEl.addEventListener('focus', () => select());
  midEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); clearSelectionMemory(); select(); startDrag(e, 'move'); });
  midEl.addEventListener('dblclick', () => { midEl.focus(); });

  if ('ResizeObserver' in window) new ResizeObserver(() => { updateTransform(); }).observe(midEl);

  applyTextStyle();
  updateTransform();
  syncTextarea();
  select();
}

function applyTextStyle() {
  if (!midEl || S.mode !== 'text') return;
  const t = S.text;
  midEl.style.width = (S.t.boxW * S.comp.width) + 'px';
  midEl.style.fontFamily = `"${t.font}"`;
  midEl.style.fontWeight = t.weight;
  midEl.style.fontStyle = t.font === 'Gestura Text' ? 'italic' : 'normal';
  midEl.style.fontSize = t.size + 'px';
  midEl.style.lineHeight = t.lineHeight;
  midEl.style.color = t.color;
  midEl.style.textAlign = t.align;
  midEl.style.letterSpacing = t.letterSpacing ? t.letterSpacing + 'em' : '';
  midEl.style.textShadow = t.shadow ? '0 2px 18px rgba(0,0,0,.45)' : '';
  midEl.setAttribute('dir', t.dir);
}

function syncTextarea() {
  const ta = $('#textInput');
  const styled = hasRunStyling(S.text.html);
  ta.value = richTextToPlain(S.text.html);
  ta.readOnly = styled;
  $('#styledNote').classList.toggle('hidden', !styled);
}

/* ---------- media ---------- */

function mountMedia() {
  const host = $('.mid-host', stageEl);
  if (!host) return;
  host.innerHTML = '';
  midEl = null;
  if (!S.media) { hideGizmo(); return; }

  midEl = document.createElement('div');
  midEl.className = 'obj is-media';
  midEl.appendChild(S.media.el);
  host.appendChild(midEl);

  const nw = S.media.kind === 'video' ? S.media.el.videoWidth : S.media.el.naturalWidth;
  const nh = S.media.kind === 'video' ? S.media.el.videoHeight : S.media.el.naturalHeight;
  const ar = (nw && nh) ? nw / nh : 1;
  const targetW = S.comp.width * 0.7;
  const targetH = targetW / ar;
  midEl.style.width = targetW + 'px';
  midEl.style.height = targetH + 'px';
  if (!S.media.placed) {
    S.t = { x: .5, y: .5, scale: 1, rotation: 0, boxW: S.t.boxW };
    S.media.placed = true;
  }

  midEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); select(); startDrag(e, 'move'); });
  updateTransform();
  select();
}

async function handleFile(file) {
  if (!file) return;
  const isImg = /^image\//.test(file.type);
  const isVid = /^video\//.test(file.type);
  if (!isImg && !isVid) { toast('Please choose an image or a video file.'); return; }
  if (file.size > 400 * 1024 * 1024) { toast('That file is over 400 MB — please use a smaller one.'); return; }

  if (S.media?.url) URL.revokeObjectURL(S.media.url);
  const url = URL.createObjectURL(file);

  try {
    let el, hasAudio = false;
    if (isVid) {
      el = document.createElement('video');
      el.src = url; el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
      el.setAttribute('playsinline', '');
      await whenVideoReady(el);
      hasAudio = !!(el.mozHasAudio || el.webkitAudioDecodedByteCount > 0 ||
                    (el.audioTracks && el.audioTracks.length));
      el.play().catch(() => {});
    } else {
      el = new Image();
      el.src = url;
      await el.decode();
    }
    S.media = { kind: isVid ? 'video' : 'image', el, url, name: file.name, size: file.size, hasAudio, placed: false };
    $('#dropZone').classList.add('hidden');
    const chip = $('#fileChip');
    chip.classList.remove('hidden');
    $('.fn', chip).textContent = file.name;
    $('.fs', chip).textContent = fmtBytes(file.size);
    $('#mediaSoundRow').classList.toggle('hidden', !(isVid && hasAudio));
    mountMedia();
    refreshExportSummary();
  } catch (e) {
    URL.revokeObjectURL(url);
    toast('That file couldn’t be read. Try an MP4, MOV, JPG or PNG.');
  }
}

/* ============================================================
   Transform + gizmo
   ============================================================ */

function objSize() {
  if (!midEl) return { w: 0, h: 0 };
  return { w: midEl.offsetWidth, h: midEl.offsetHeight };
}

function updateTransform() {
  if (!midEl || !S.comp) return;
  const { w, h } = objSize();
  const x = S.t.x * S.comp.width, y = S.t.y * S.comp.height;
  const tf = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${S.t.rotation}deg) scale(${S.t.scale})`;
  midEl.style.transform = tf;
  updateGizmo();
}

function updateGizmo() {
  if (!gizmoEl || !midEl || !S.selected || !S.comp) return;
  const { w, h } = objSize();
  const x = S.t.x * S.comp.width, y = S.t.y * S.comp.height;
  gizmoEl.style.width = w + 'px';
  gizmoEl.style.height = h + 'px';
  gizmoEl.style.transform =
    `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${S.t.rotation}deg) scale(${S.t.scale})`;
  const sideOnly = S.mode === 'text';
  $('[data-h="w"]', gizmoEl).style.display = sideOnly ? '' : 'none';
  $('[data-h="e"]', gizmoEl).style.display = sideOnly ? '' : 'none';
}

function select() {
  if (!midEl) return;
  S.selected = true;
  gizmoEl.classList.remove('hidden');
  updateGizmo();
}
function deselect() {
  S.selected = false;
  hideGizmo();
  if (midEl && S.mode === 'text') midEl.blur();
}
function hideGizmo() { gizmoEl?.classList.add('hidden'); }

function stagePoint(e) {
  const r = stageEl.getBoundingClientRect();
  const s = r.width / S.comp.width;
  return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
}

function wireGizmo() {
  $$('.h', gizmoEl).forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      startDrag(e, h.dataset.h);
    });
  });
}

function startDrag(e, handle) {
  if (S.exporting) return;
  if (!S.preset.allow.transform && handle !== 'move') return;

  /* On text, a click places the caret and a drag moves the block.
     We only commit to dragging once the pointer has actually travelled. */
  const needsThreshold = S.mode === 'text' && handle === 'move';
  let armed = !needsThreshold;
  const origin = { cx: e.clientX, cy: e.clientY };

  const start = stagePoint(e);
  const t0 = { ...S.t };
  const cx = t0.x * S.comp.width, cy = t0.y * S.comp.height;
  const d0 = Math.hypot(start.x - cx, start.y - cy) || 1;
  const a0 = Math.atan2(start.y - cy, start.x - cx);
  if (armed) midEl.classList.add('dragging');

  const snapPx = S.comp.width * 0.012;

  const move = (ev) => {
    if (!armed) {
      if (Math.hypot(ev.clientX - origin.cx, ev.clientY - origin.cy) < 4) return;
      armed = true;
      midEl.blur();                     /* leaving edit mode; now we move */
      midEl.classList.add('dragging');
    }
    const p = stagePoint(ev);
    if (handle === 'move') {
      let nx = (t0.x * S.comp.width) + (p.x - start.x);
      let ny = (t0.y * S.comp.height) + (p.y - start.y);
      const snapV = Math.abs(nx - S.comp.width / 2) < snapPx;
      const snapH = Math.abs(ny - S.comp.height / 2) < snapPx;
      if (snapV) nx = S.comp.width / 2;
      if (snapH) ny = S.comp.height / 2;
      showSnap(snapV, snapH);
      S.t.x = clamp(nx / S.comp.width, -0.5, 1.5);
      S.t.y = clamp(ny / S.comp.height, -0.5, 1.5);
    } else if (handle === 'rot') {
      const a = Math.atan2(p.y - cy, p.x - cx);
      let deg = t0.rotation + (a - a0) * 180 / Math.PI;
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      if (Math.abs(deg % 360) < 3) deg = Math.round(deg / 360) * 360;
      S.t.rotation = deg;
    } else if (handle === 'w' || handle === 'e') {
      const a = -t0.rotation * Math.PI / 180;
      const dx = p.x - cx, dy = p.y - cy;
      const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / (t0.scale || 1);
      const w = clamp(Math.abs(lx) * 2, S.comp.width * 0.08, S.comp.width * 1.6);
      S.t.boxW = w / S.comp.width;
      if (S.mode === 'text') midEl.style.width = w + 'px';
    } else {
      const d = Math.hypot(p.x - cx, p.y - cy);
      S.t.scale = clamp(t0.scale * (d / d0), 0.05, 12);
    }
    updateTransform();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    midEl.classList.remove('dragging');
    showSnap(false, false);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function showSnap(v, h) {
  const sv = $('#snapV'), sh = $('#snapH');
  if (!sv || !sh) return;
  const t = 1.5 / S.scale;
  sv.style.cssText = `left:${S.comp.width / 2 - t / 2}px;top:0;width:${t}px;height:100%`;
  sh.style.cssText = `top:${S.comp.height / 2 - t / 2}px;left:0;height:${t}px;width:100%`;
  sv.classList.toggle('on', !!v);
  sh.classList.toggle('on', !!h);
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function onKey(e) {
  if (S.exporting) return;
  const editing = document.activeElement === midEl ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (e.key === 'Escape') { deselect(); return; }
  if (!S.selected || editing) return;
  const step = e.shiftKey ? 10 : 1;
  const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (map[e.key]) {
    e.preventDefault();
    S.t.x += map[e.key][0] / S.comp.width;
    S.t.y += map[e.key][1] / S.comp.height;
    updateTransform();
  }
}

/* ============================================================
   Selection-aware styling
   ============================================================ */

function rememberSelection() {
  if (!midEl || S.mode !== 'text') return;
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const r = sel.getRangeAt(0);
  if (!midEl.contains(r.commonAncestorContainer)) return;
  /* Keep the last real selection: clicking a control in the rail must not
     wipe it, so a collapsed range is only cleared by clicking in the text. */
  if (!r.collapsed) S.lastRange = r.cloneRange();
  showSelectionState();
}

function clearSelectionMemory() {
  S.lastRange = null;
  showSelectionState();
}

function showSelectionState() {
  const note = $('#selNote');
  if (!note) return;
  const r = S.lastRange;
  const txt = r && !r.collapsed ? String(r.toString()).trim() : '';
  if (txt) {
    const words = txt.split(/\s+/).filter(Boolean).length;
    note.innerHTML = `Styling <strong>${words} selected ${words === 1 ? 'word' : 'words'}</strong>. ` +
      `<button class="btn ghost" id="clearSel" style="padding:1px 5px">Style everything instead</button>`;
    $('#clearSel').addEventListener('click', () => {
      document.getSelection()?.removeAllRanges();
      clearSelectionMemory();
    });
  } else {
    note.textContent = 'Select words on the video first to style just those.';
  }
}

/** Apply CSS to the selected run, or to the whole text when nothing is selected. */
function applyStyle(styles) {
  if (S.mode !== 'text' || !midEl) return;
  const r = S.lastRange;
  const inside = r && midEl.contains(r.commonAncestorContainer) && !r.collapsed;

  if (!inside) {
    /* base style: also strip the property from every run so the change is visible */
    Object.keys(styles).forEach((prop) => {
      midEl.querySelectorAll('[style]').forEach(el => el.style.removeProperty(prop));
    });
    if (styles['font-family']) S.text.font = styles['font-family'].replace(/["']/g, '');
    if (styles['font-weight']) S.text.weight = parseInt(styles['font-weight'], 10);
    if (styles['color'])       S.text.color = styles['color'];
    applyTextStyle();
  } else {
    wrapRange(r, styles);
  }
  S.text.html = sanitizeRichText(midEl.innerHTML);
  syncTextarea();
  requestAnimationFrame(updateTransform);
}

function wrapRange(range, styles) {
  const frag = range.extractContents();
  const holder = document.createElement('div');
  holder.appendChild(frag);

  const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue) texts.push(walker.currentNode);

  texts.forEach((tn) => {
    const span = document.createElement('span');
    for (const [k, v] of Object.entries(styles)) span.style.setProperty(k, v);
    tn.replaceWith(span);
    span.appendChild(tn);
  });
  /* drop the same property from wrappers so the inner run wins cleanly */
  holder.querySelectorAll('[style]').forEach((el) => {
    if (el.querySelector('span[style]')) Object.keys(styles).forEach(k => el.style.removeProperty(k));
  });

  const out = document.createDocumentFragment();
  const nodes = [...holder.childNodes];
  nodes.forEach(n => out.appendChild(n));
  range.insertNode(out);

  const sel = document.getSelection();
  sel.removeAllRanges();
  const nr = document.createRange();
  if (nodes.length) { nr.setStartBefore(nodes[0]); nr.setEndAfter(nodes[nodes.length - 1]); }
  sel.addRange(nr);
  S.lastRange = nr.cloneRange();
  midEl.normalize();
}

/* ============================================================
   Rail markup
   ============================================================ */

function buildRail() {
  const fontButtons = FONTS.map(f =>
    `<button data-font="${esc(f.css)}" aria-pressed="false">${esc(f.label)}</button>`).join('');

  $('#railBody').innerHTML = `
  <section class="step" data-step="1" data-open="true" data-done="false">
    <button class="head" aria-expanded="true">
      <span class="num">01</span>
      <span class="titles"><span class="t">Choose a template</span><span class="s">Pick the campaign format</span></span>
      <span class="chev">${ICON.chev}</span>
    </button>
    <div class="body"><div class="inner"><div class="pad">
      <span class="bar" style="margin-bottom:12px"></span>
      <div class="presets" id="presetList"></div>
    </div></div></div>
  </section>

  <section class="step" data-step="2" data-open="false" data-done="false">
    <button class="head" aria-expanded="false" disabled>
      <span class="num">02</span>
      <span class="titles"><span class="t">Add your content</span><span class="s">Type a message or upload a file</span></span>
      <span class="chev">${ICON.chev}</span>
    </button>
    <div class="body"><div class="inner"><div class="pad">
      <span class="bar" style="margin-bottom:12px"></span>

      <div class="seg" id="modeSeg">
        <button id="modeText" data-mode="text" aria-pressed="false">Text</button>
        <button id="modeMedia" data-mode="media" aria-pressed="false">Image or video</button>
      </div>

      <!-- TEXT -->
      <div id="textPanel" style="display:none">
        <div class="field">
          <span class="label">Your text</span>
          <textarea id="textInput" placeholder="Type your message…" rows="3"></textarea>
          <div class="hint hidden" id="styledNote">
            You’ve styled individual words, so edit this text on the video itself.
            <button class="btn ghost" id="clearStyling" style="padding:2px 6px">Reset word styling</button>
          </div>
        </div>

        <div class="field" id="fontField">
          <span class="label">Typeface</span>
          <div class="seg" id="fontSeg">${fontButtons}</div>
          <div class="seg" id="weightSeg" style="margin-top:6px"></div>
          <div class="hint" id="selNote">Select words on the video first to style just those.</div>
        </div>

        <div class="field" id="sizeField">
          <span class="label">Size</span>
          <input type="range" id="sizeRange" min="1" max="30" step="0.25">
        </div>

        <div class="field" id="colorField">
          <span class="label">Colour</span>
          <div class="swatches" id="swatches"></div>
        </div>

        <div class="field">
          <span class="label">Alignment</span>
          <div class="seg" id="alignSeg">
            <button data-align="left" aria-pressed="false" title="Align left">${ICON.left}</button>
            <button data-align="center" aria-pressed="true" title="Align centre">${ICON.center}</button>
            <button data-align="right" aria-pressed="false" title="Align right">${ICON.right}</button>
          </div>
        </div>

        <details class="disclosure">
          <summary>More text options</summary>
          <div class="field">
            <span class="label">Line spacing</span>
            <input type="range" id="lhRange" min="0.8" max="2" step="0.01">
          </div>
          <div class="field">
            <span class="label">Letter spacing</span>
            <input type="range" id="lsRange" min="-0.06" max="0.4" step="0.005">
          </div>
          <div class="field">
            <span class="label">Text direction</span>
            <div class="seg" id="dirSeg">
              <button data-dir="auto" aria-pressed="true">Automatic</button>
              <button data-dir="rtl" aria-pressed="false">עברית</button>
              <button data-dir="ltr" aria-pressed="false">English</button>
            </div>
          </div>
          <label class="chk"><input type="checkbox" id="shadowChk"> Soft shadow behind the text</label>
        </details>
      </div>

      <!-- MEDIA -->
      <div id="mediaPanel" style="display:none">
        <div class="field">
          <div class="drop" id="dropZone" tabindex="0" role="button">
            ${ICON.up}
            <div class="big">Choose an image or video</div>
            <div class="sm">MP4, MOV, WebM, JPG, PNG · or drop a file here</div>
          </div>
          <div class="filechip hidden" id="fileChip">
            <span class="fn"></span><span class="fs"></span>
            <button class="btn ghost" id="removeFile">Replace</button>
          </div>
          <input type="file" id="fileInput" accept="image/*,video/*" hidden>
        </div>
        <div class="field hidden" id="mediaSoundRow">
          <label class="chk"><input type="checkbox" id="mediaSound" checked> Keep the sound from my video</label>
        </div>
        <div class="hint">Drag it on the video to move. Corners scale, the top dot rotates.</div>
      </div>

      <div class="rule"><span class="bar"></span><span class="txt">Placement</span><span class="ln"></span></div>
      <div class="row wrap" style="gap:6px">
        <button class="btn" id="btnCentre">Centre it</button>
        <button class="btn" id="btnReset">Reset size &amp; angle</button>
      </div>
      <div class="hint">Drag to move · corners scale · top dot rotates · arrow keys nudge</div>
    </div></div></div>
  </section>

  <section class="step" data-step="3" data-open="false" data-done="false">
    <button class="head" aria-expanded="false" disabled>
      <span class="num">03</span>
      <span class="titles"><span class="t">Download your video</span><span class="s">MP4, ready to post</span></span>
      <span class="chev">${ICON.chev}</span>
    </button>
    <div class="body"><div class="inner"><div class="pad">
      <span class="bar" style="margin-bottom:12px"></span>

      <div class="field">
        <span class="label">File name</span>
        <input type="text" id="fileName" placeholder="pitaro-campaign">
      </div>

      <div class="field">
        <span class="label">Quality</span>
        <div class="seg" id="qualitySeg">
          <button data-q="standard" aria-pressed="false">Standard</button>
          <button data-q="high" aria-pressed="true">High</button>
          <button data-q="max" aria-pressed="false">Maximum</button>
        </div>
      </div>

      <div class="field" id="soundField">
        <span class="label">Sound</span>
        <label class="chk"><input type="checkbox" id="templateSound" checked> Keep the template’s sound</label>
      </div>

      <div class="field">
        <button class="btn-export" id="btnExport">${ICON.down} Export MP4</button>
        <div class="hint" id="exportSummary"></div>
      </div>

      <div class="progress hidden" id="progress">
        <div class="ptrack"><div class="pfill" id="pfill"></div></div>
        <div class="pmeta"><span id="pstage">Rendering frames…</span><span class="pct" id="ppct">0%</span></div>
        <button class="btn ghost" id="btnCancel" style="margin-top:6px">Cancel</button>
      </div>

      <div class="result hidden" id="result">
        <div class="rt">${ICON.check} <span id="rtitle">Your video is ready</span></div>
        <div class="rs" id="rsub"></div>
        <button class="btn solid block" id="btnSaveAgain">${ICON.down} Save again</button>
      </div>

      <div class="warn hidden" id="codecWarn">${ICON.alert}<span></span></div>
    </div></div></div>
  </section>`;

  wireControls();
}

/* ============================================================
   Controls
   ============================================================ */

function wireControls() {
  $$('#modeSeg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  $('#textInput').addEventListener('input', (e) => {
    S.text.html = plainToHTML(e.target.value);
    if (midEl && S.mode === 'text') { midEl.innerHTML = S.text.html; requestAnimationFrame(updateTransform); }
    refreshExportSummary();
  });
  $('#clearStyling').addEventListener('click', () => {
    S.text.html = plainToHTML(richTextToPlain(S.text.html));
    if (midEl) midEl.innerHTML = S.text.html;
    syncTextarea();
    requestAnimationFrame(updateTransform);
  });

  $$('#fontSeg button').forEach((b) => {
    b.addEventListener('click', () => {
      const fam = b.dataset.font;
      const def = FONTS.find(f => f.css === fam);
      const weight = nearestWeight(def, S.text.weight);
      const styles = { 'font-family': `"${fam}"`, 'font-style': def.italic ? 'italic' : 'normal' };
      const toBase = !S.lastRange;
      if (toBase) styles['font-weight'] = String(weight);
      applyStyle(styles);
      if (toBase) { S.text.font = fam; S.text.weight = weight; applyTextStyle(); }
      syncStyleControls();
    });
  });

  $('#sizeRange').addEventListener('input', (e) => {
    S.text.size = Math.round(S.comp.width * (parseFloat(e.target.value) / 100));
    applyTextStyle(); requestAnimationFrame(updateTransform);
  });
  $('#lhRange').addEventListener('input', (e) => {
    S.text.lineHeight = parseFloat(e.target.value); applyTextStyle(); requestAnimationFrame(updateTransform);
  });
  $('#lsRange').addEventListener('input', (e) => {
    S.text.letterSpacing = parseFloat(e.target.value); applyTextStyle(); requestAnimationFrame(updateTransform);
  });
  $('#shadowChk').addEventListener('change', (e) => { S.text.shadow = e.target.checked; applyTextStyle(); });

  $$('#alignSeg button').forEach(b => b.addEventListener('click', () => {
    S.text.align = b.dataset.align;
    $$('#alignSeg button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    applyTextStyle(); requestAnimationFrame(updateTransform);
  }));

  $$('#dirSeg button').forEach(b => b.addEventListener('click', () => {
    S.text.dir = b.dataset.dir;
    $$('#dirSeg button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    applyTextStyle();
  }));

  /* colour swatches */
  const sw = $('#swatches');
  sw.innerHTML = SWATCHES.map(c =>
    `<button class="sw" data-c="${c}" style="background:${c}" title="${c}" aria-pressed="false"></button>`).join('') +
    `<span class="sw sw-custom" title="Custom colour"><input type="color" id="customColor" value="${DEFAULT_COLOR}"></span>`;
  $$('.sw[data-c]', sw).forEach(b => b.addEventListener('click', () => setColor(b.dataset.c)));
  $('#customColor').addEventListener('input', (e) => setColor(e.target.value));

  /* upload */
  const dz = $('#dropZone'), fi = $('#fileInput');
  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
  fi.addEventListener('change', (e) => handleFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
  $('#removeFile').addEventListener('click', () => {
    if (S.media?.url) URL.revokeObjectURL(S.media.url);
    S.media = null;
    $('#fileChip').classList.add('hidden');
    $('#dropZone').classList.remove('hidden');
    $('#mediaSoundRow').classList.add('hidden');
    mountMedia(); refreshExportSummary();
  });
  $('#mediaSound').addEventListener('change', (e) => { S.sound.media = e.target.checked; });
  $('#templateSound').addEventListener('change', (e) => { S.sound.template = e.target.checked; });

  $('#btnCentre').addEventListener('click', () => { S.t.x = .5; S.t.y = .5; updateTransform(); });
  $('#btnReset').addEventListener('click', () => { S.t.scale = 1; S.t.rotation = 0; updateTransform(); });

  $$('#qualitySeg button').forEach(b => b.addEventListener('click', () => {
    $$('#qualitySeg button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    refreshExportSummary();
  }));

  $('#fileName').addEventListener('input', () => { S.fileNameTouched = true; });
  $('#btnExport').addEventListener('click', runExport);
  $('#btnCancel').addEventListener('click', () => S.abort?.abort());
}

function setColor(c) {
  applyStyle({ color: c });
  if (!S.lastRange) S.text.color = c;
  $$('.sw[data-c]').forEach(b => b.setAttribute('aria-pressed', b.dataset.c.toLowerCase() === c.toLowerCase() ? 'true' : 'false'));
}

function syncStyleControls() {
  const def = FONTS.find(f => f.css === S.text.font) || FONTS[0];
  $$('#fontSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.font === S.text.font ? 'true' : 'false'));

  const ws = $('#weightSeg');
  ws.innerHTML = def.weights.map(w =>
    `<button data-w="${w.v}" aria-pressed="${w.v === S.text.weight ? 'true' : 'false'}">${esc(w.label)}</button>`).join('');
  ws.style.display = def.weights.length > 1 ? '' : 'none';
  $$('button', ws).forEach(b => b.addEventListener('click', () => {
    applyStyle({ 'font-weight': b.dataset.w });
    if (!S.lastRange) { S.text.weight = +b.dataset.w; applyTextStyle(); }
    $$('button', ws).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  }));

  if (S.comp) $('#sizeRange').value = (S.text.size / S.comp.width * 100).toFixed(2);
  $('#lhRange').value = S.text.lineHeight;
  $('#lsRange').value = S.text.letterSpacing;
  $$('#alignSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.align === S.text.align ? 'true' : 'false'));
  $$('.sw[data-c]').forEach(b => b.setAttribute('aria-pressed', b.dataset.c.toLowerCase() === String(S.text.color).toLowerCase() ? 'true' : 'false'));
}

/* ============================================================
   Transport
   ============================================================ */

function wireTransport() {
  const tp = $('#transport');
  tp.classList.toggle('hidden', !(bgEl instanceof HTMLVideoElement || fgEl instanceof HTMLVideoElement));
  const scrub = $('#scrub'), btn = $('#btnPlay'), time = $('#time');
  scrub.max = String(S.comp.duration);
  time.textContent = `0:00.0 / ${fmtTime(S.comp.duration)}`;

  const vids = () => [bgEl, fgEl, S.media?.el].filter(v => v instanceof HTMLVideoElement);

  btn.onclick = () => {
    S.playing = !S.playing;
    btn.innerHTML = S.playing ? ICON.pause : ICON.play;
    btn.setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
    vids().forEach(v => S.playing ? v.play().catch(() => {}) : v.pause());
  };
  scrub.oninput = () => {
    const t = parseFloat(scrub.value);
    vids().forEach((v) => { try { v.currentTime = t % (v.duration || S.comp.duration); } catch (_) {} });
    time.textContent = `${fmtTime(t)} / ${fmtTime(S.comp.duration)}`;
  };

  const clock = () => {
    if (!S.exporting && S.playing) {
      const lead = vids()[0];
      if (lead) {
        let t = lead.currentTime;
        if (t >= S.comp.duration) { vids().forEach(v => { try { v.currentTime = 0; } catch (_) {} }); t = 0; }
        scrub.value = String(t);
        time.textContent = `${fmtTime(t)} / ${fmtTime(S.comp.duration)}`;
        vids().slice(1).forEach((v) => {
          const target = t % (v.duration || S.comp.duration);
          if (Math.abs(v.currentTime - target) > 0.12) { try { v.currentTime = target; } catch (_) {} }
        });
      }
    }
    requestAnimationFrame(clock);
  };
  requestAnimationFrame(clock);
}

/* ============================================================
   Step 3 — export
   ============================================================ */

function currentQuality() {
  return $('#qualitySeg button[aria-pressed="true"]')?.dataset.q || 'high';
}

function hasContent() {
  if (S.mode === 'text') return !!richTextToPlain(S.text.html);
  if (S.mode === 'media') return !!S.media;
  return false;
}

function refreshExportSummary() {
  const ready = !!S.preset;
  enableStep(3, ready);
  if (!ready) return;
  const c = S.comp;
  const frames = Math.round(c.duration * c.fps);
  $('#exportSummary').textContent =
    `${c.width}×${c.height} · ${c.fps} fps · ${(+c.duration).toFixed(1)}s · ${frames} frames`;
  $('#btnExport').disabled = S.exporting;

  const soundable = !!(S.preset.allow.sound && (S.preset.audio && S.preset.audio !== 'none'));
  $('#soundField').style.display = soundable ? '' : 'none';

  if (!S.fileNameTouched) {
    const words = richTextToPlain(S.text.html).split(/\s+/).slice(0, 4).join(' ');
    $('#fileName').value = slugify(`${S.preset.name} ${S.mode === 'text' ? words : (S.media?.name || '')}`);
  }
  const done = hasContent();
  setStepDone(2, done, done
    ? (S.mode === 'text' ? `“${richTextToPlain(S.text.html).slice(0, 34)}”` : S.media.name)
    : 'Type a message or upload a file');
}

async function runExport() {
  if (!S.preset) { toast('Pick a template first.'); return; }
  if (!hasContent()) {
    toast(S.mode === 'media' ? 'Add an image or a video first.' : 'Type your message first.');
    openStep(2); return;
  }

  S.exporting = true;
  S.abort = new AbortController();
  deselect();
  S.playing = false;
  $('#btnPlay').innerHTML = ICON.play;
  [bgEl, fgEl, S.media?.el].forEach(v => { if (v instanceof HTMLVideoElement) v.pause(); });

  $('#btnExport').disabled = true;
  $('#result').classList.add('hidden');
  const prog = $('#progress');
  prog.classList.remove('hidden');
  setProgress(0, 'Preparing…');

  try {
    await ensureFontsReady();

    /* middle layer, rendered at composition resolution */
    let mid = null;
    if (S.mode === 'text') {
      const boxW = S.t.boxW * S.comp.width;
      const boxH = Math.max(2, midEl.offsetHeight);
      const pad = Math.ceil(S.text.size * (S.text.shadow ? 0.7 : 0.35));
      const layer = {
        html: sanitizeRichText(midEl.innerHTML),
        boxW, boxH, pad,
        font: S.text.font, weight: S.text.weight, size: S.text.size,
        lineHeight: S.text.lineHeight, color: S.text.color, align: S.text.align,
        letterSpacing: S.text.letterSpacing, shadow: S.text.shadow, dir: S.text.dir,
      };
      let canvas, drawW = boxW + pad * 2, drawH = boxH + pad * 2;
      try {
        canvas = await rasterizeText(layer, S.comp, 2);   /* 2× for crisp edges */
      } catch (e) {
        console.warn('Falling back to canvas text:', e);
        canvas = rasterizeTextFallback(layer);
        drawW = canvas.width; drawH = canvas.height;      /* fallback has no padding */
      }
      mid = {
        canvas,
        transform: {
          x: S.t.x * S.comp.width, y: S.t.y * S.comp.height,
          w: drawW, h: drawH, scale: S.t.scale, rotation: S.t.rotation,
        },
      };
    } else if (S.media) {
      const el = S.media.el;
      const nw = S.media.kind === 'video' ? el.videoWidth : el.naturalWidth;
      const nh = S.media.kind === 'video' ? el.videoHeight : el.naturalHeight;
      const w = midEl.offsetWidth, h = midEl.offsetHeight;
      mid = S.media.kind === 'video'
        ? { sampler: makeSampler(el, { loop: true }),
            transform: { x: S.t.x * S.comp.width, y: S.t.y * S.comp.height, w, h, scale: S.t.scale, rotation: S.t.rotation } }
        : { canvas: toCanvas(el, nw, nh),
            transform: { x: S.t.x * S.comp.width, y: S.t.y * S.comp.height, w, h, scale: S.t.scale, rotation: S.t.rotation } };
    }

    /* audio sources */
    const audio = [];
    if (S.preset.allow.sound && S.sound.template && S.preset.audio && S.preset.audio !== 'none') {
      const src = S.preset.audio === 'foreground' ? S.preset.foreground : S.preset.background;
      if (src && isVideoSrc(src)) audio.push({ url: src, gain: 1 });
    }
    if (S.mode === 'media' && S.media?.kind === 'video' && S.media.hasAudio && S.sound.media) {
      audio.push({ url: S.media.url, gain: 1 });
    }

    const job = {
      comp: S.comp,
      bg: bgEl ? makeSampler(bgEl) : null,
      fg: fgEl ? makeSampler(fgEl) : null,
      mid,
      audio,
      quality: currentQuality(),
      signal: S.abort.signal,
      onProgress: (f, stage) => setProgress(f, stage === 'audio' ? 'Adding sound…' : 'Rendering frames…'),
    };

    const support = exportSupport();
    const blob = support.mp4 ? await exportMP4(job) : await exportWebMFallback(job);
    const ext = support.mp4 ? 'mp4' : 'webm';
    const name = (slugify($('#fileName').value || 'pitaro-campaign')) + '.' + ext;

    download(blob, name);
    $('#result').classList.remove('hidden');
    $('#rtitle').textContent = `Saved ${name}`;
    $('#rsub').textContent =
      `${fmtBytes(blob.size)} · ${S.comp.width}×${S.comp.height} · ${(+S.comp.duration).toFixed(1)}s`;
    $('#btnSaveAgain').onclick = () => download(blob, name);
    setStepDone(3, true, `${ext.toUpperCase()} · ${fmtBytes(blob.size)}`);
  } catch (e) {
    if (e?.name === 'AbortError') {
      toast('Export cancelled.');
    } else if (String(e.message) === 'NO_WEBCODECS') {
      toast('This browser can’t export video. Try Chrome, Edge or Safari 17+.');
    } else {
      console.error(e);
      toast(e.message || 'The export failed. Try a shorter template or a smaller file.');
    }
  } finally {
    S.exporting = false;
    S.abort = null;
    $('#btnExport').disabled = false;
    $('#progress').classList.add('hidden');
  }
}

function toCanvas(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c;
}

function setProgress(f, label) {
  const pct = Math.round(Math.min(1, Math.max(0, f)) * 100);
  $('#pfill').style.width = pct + '%';
  $('#ppct').textContent = pct + '%';
  if (label) $('#pstage').textContent = label;
}

/* ============================================================
   Toast
   ============================================================ */

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 4200);
}
