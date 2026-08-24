/* ============================================================
   Pitaro Toolbox — engine
   Preset model, media sampling, text rasterisation and the
   frame-accurate MP4 exporter.
   ============================================================ */

import { Muxer, ArrayBufferTarget } from './mp4-muxer.mjs';

/* ---------- constants ---------- */

export const FONTS = [
  { id: 'ezer',    label: 'Ezer Standard',  css: 'Ezer Standard', italic: false,
    defaultWeight: 500,
    weights: [
      { v: 250, label: 'Light' },
      { v: 300, label: 'Book' },
      { v: 400, label: 'Regular' },
      { v: 500, label: 'SemiBold' },
    ],
    files: {
      250: 'assets/fonts/EzerStandard-Light.woff2',
      300: 'assets/fonts/EzerStandard-Book.woff2',
      400: 'assets/fonts/EzerStandard-Regular.woff2',
      500: 'assets/fonts/EzerStandard-SemiBold.woff2',
    }
  },
  { id: 'gestura', label: 'Gestura Text',   css: 'Gestura Text', italic: true,
    defaultWeight: 900,
    weights: [ { v: 900, label: 'Black Italic' } ],
    files: { 900: 'assets/fonts/GesturaText-BlackItalic.woff2' }
  },
];

export const DEFAULT_COLOR  = '#F3F3F3';
export const DEFAULT_FONT   = 'Ezer Standard';
export const DEFAULT_WEIGHT = 500;   /* SemiBold */

/** Closest weight a family can offer to the one in use, so switching
    typeface keeps the intent instead of snapping to the lightest cut. */
export function nearestWeight(family, current) {
  const def = typeof family === 'string' ? FONTS.find(f => f.css === family) : family;
  if (!def) return DEFAULT_WEIGHT;
  if (!Number.isFinite(current)) return def.defaultWeight;
  return def.weights
    .map(w => w.v)
    .reduce((best, v) => Math.abs(v - current) < Math.abs(best - current) ? v : best);
}

export const SWATCHES = ['#F3F3F3', '#101113', '#FF4A1C', '#F2C14E', '#2E6BFF', '#12805A'];

/* Text CSS shared by the live preview and the export rasteriser.
   Any change here must stay identical in both paths. */
export const TEXT_CSS = `
.obj-text{
  white-space:pre-wrap; word-break:break-word; margin:0; padding:0;
  font-synthesis:none; -webkit-font-smoothing:antialiased;
  font-kerning:normal; font-variant-ligatures:common-ligatures;
}
.obj-text *{ margin:0; padding:0; }
.obj-text div{ min-height:1em; }
`;

/* ============================================================
   Presets
   ============================================================ */

export function blankPreset(id) {
  return {
    id: id || 'preset-' + Math.random().toString(36).slice(2, 8),
    name: 'Untitled template',
    note: '',
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 6,
    background: '',        /* path or URL — mp4/webm/jpg/png */
    backgroundAlt: '',     /* optional second source */
    foreground: '',        /* alpha overlay — webm(vp9+alpha) */
    foregroundAlt: '',     /* optional .mov (hevc+alpha) for Safari */
    poster: '',            /* still used on the template card */
    audio: 'background',   /* background | foreground | none */
    text: {
      x: 0.5, y: 0.5,      /* centre, fraction of composition */
      width: 0.72,         /* text box width, fraction of comp width */
      size: 0.075,         /* font size, fraction of comp width */
      align: 'center',
      lineHeight: 1.15,
      color: DEFAULT_COLOR,
      font: DEFAULT_FONT,
      weight: DEFAULT_WEIGHT,
      placeholder: 'Your message here',
    },
    allow: {
      text: true, upload: true, color: true,
      font: true, size: true, transform: true, sound: true,
    },
  };
}

export function normalisePreset(p) {
  const b = blankPreset(p && p.id);
  const out = { ...b, ...(p || {}) };
  out.text  = { ...b.text,  ...((p && p.text)  || {}) };
  out.allow = { ...b.allow, ...((p && p.allow) || {}) };
  out.width    = clampInt(out.width, 16, 7680, 1080);
  out.height   = clampInt(out.height, 16, 7680, 1920);
  out.fps      = clampInt(out.fps, 1, 60, 30);
  out.duration = clampNum(out.duration, 0.1, 600, 6);
  /* H.264 requires even dimensions */
  out.width  -= out.width % 2;
  out.height -= out.height % 2;
  return out;
}

function clampInt(v, lo, hi, dflt) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}
function clampNum(v, lo, hi, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

export async function loadPresets(url = 'presets.json') {
  let list = [];
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      list = Array.isArray(data) ? data : (data.presets || []);
    }
  } catch (_) { /* file:// or missing — fall through */ }

  /* An admin previewing unsaved work opens the tool with ?preview=1 */
  if (new URLSearchParams(location.search).has('preview')) {
    try {
      const draft = JSON.parse(localStorage.getItem('pitaro.presets.draft') || 'null');
      if (Array.isArray(draft) && draft.length) list = draft;
    } catch (_) {}
  }
  return list.map(normalisePreset);
}

/* ============================================================
   Small helpers
   ============================================================ */

export const esc = (s) => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const fmtTime = (s) => {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
};

export const fmtBytes = (b) => {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
};

export function isVideoSrc(src = '') {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(src);
}

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD')
    .replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-').slice(0, 60) || 'pitaro-video';
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ============================================================
   Rich-text model
   The middle text layer is edited as HTML in a contenteditable
   so that Hebrew/RTL, mixed runs and per-word fonts all come
   from the browser's own text engine.
   ============================================================ */

const ALLOWED_TAGS  = new Set(['DIV', 'BR', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'P']);
const DROP_TAGS     = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'MATH']);
const ALLOWED_STYLE = ['font-family', 'font-weight', 'font-style', 'color', 'font-size', 'text-decoration'];

/** Parse into an inert document: nothing executes, nothing is fetched. */
function parseInert(html) {
  const doc = new DOMParser().parseFromString(
    '<!DOCTYPE html><body>' + String(html || '') + '</body>', 'text/html');
  return doc.body;
}

/** Strip anything that is not a safe inline run. Used on paste and before export. */
export function sanitizeRichText(html) {
  const body = parseInert(html);

  const clean = (node) => {
    let child = node.firstChild;
    while (child) {
      const next = child.nextSibling;
      if (child.nodeType === 3) {
        /* text survives untouched */
      } else if (child.nodeType !== 1 || DROP_TAGS.has(child.tagName)) {
        child.remove();
      } else if (!ALLOWED_TAGS.has(child.tagName)) {
        /* unknown wrapper: keep the words, drop the element */
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        child.remove();
        clean(node);
        return;
      } else {
        const keep = [];
        for (const prop of ALLOWED_STYLE) {
          const v = child.style.getPropertyValue(prop);
          if (v && !/url\s*\(|expression|javascript:/i.test(v)) keep.push(`${prop}:${v}`);
        }
        [...child.attributes].forEach(a => child.removeAttribute(a.name));
        if (keep.length) child.setAttribute('style', keep.join(';'));
        clean(child);
      }
      child = next;
    }
  };

  clean(body);
  return body.innerHTML;
}

/** Plain text of a rich-text fragment. Blank lines are preserved. */
export function richTextToPlain(html) {
  const body = parseInert(html);
  let out = '';
  const walk = (node) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { out += c.nodeValue; continue; }
      if (c.nodeType !== 1) continue;
      if (c.tagName === 'BR') { out += '\n'; continue; }
      const block = c.tagName === 'DIV' || c.tagName === 'P';
      if (block && out && !out.endsWith('\n')) out += '\n';
      walk(c);
      if (block && !out.endsWith('\n')) out += '\n';
    }
  };
  walk(body);
  return out.replace(/\n$/, '');
}

/** Does the fragment carry any per-run styling? */
export function hasRunStyling(html) {
  return !!parseInert(html).querySelector('span[style], b, strong, i, em, u');
}

/* ============================================================
   Font embedding — fonts must travel inside the export SVG
   ============================================================ */

const fontCache = new Map();

async function fontDataURL(path) {
  if (fontCache.has(path)) return fontCache.get(path);
  const p = (async () => {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Font not found: ' + path);
    const buf = await res.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return 'data:font/woff2;base64,' + btoa(bin);
  })();
  fontCache.set(path, p);
  return p;
}

/** @font-face block with every face inlined as base64. */
export async function embeddedFontCSS() {
  const parts = [];
  for (const fam of FONTS) {
    for (const [weight, path] of Object.entries(fam.files)) {
      try {
        const url = await fontDataURL(path);
        parts.push(
          `@font-face{font-family:"${fam.css}";src:url(${url}) format("woff2");` +
          `font-weight:${weight};font-style:${fam.italic ? 'italic' : 'normal'};font-display:block;}`
        );
      } catch (e) { console.warn(e); }
    }
  }
  return parts.join('\n');
}

/** Make sure every face is actually loaded before we measure or draw. */
export async function ensureFontsReady() {
  const jobs = [];
  for (const fam of FONTS) {
    for (const w of Object.keys(fam.files)) {
      jobs.push(document.fonts.load(
        `${fam.italic ? 'italic ' : ''}${w} 64px "${fam.css}"`, 'Aa אב 123'
      ).catch(() => {}));
    }
  }
  await Promise.all(jobs);
  try { await document.fonts.ready; } catch (_) {}
}

/* ============================================================
   Text → bitmap
   The live text element is re-created inside an SVG foreignObject
   at full composition resolution and rasterised once per export.
   ============================================================ */

export async function rasterizeText(layer, comp, scale = 1) {
  const pad = layer.pad ?? Math.ceil(layer.size * (layer.shadow ? 0.7 : 0.35));
  const vbW = layer.boxW + pad * 2;
  const vbH = layer.boxH + pad * 2;
  const w = Math.max(2, Math.ceil(vbW * scale));
  const h = Math.max(2, Math.ceil(vbH * scale));
  const css = await embeddedFontCSS();

  const styleAttr = [
    `width:${layer.boxW}px`,
    `margin:${pad}px`,
    `font-family:'${layer.font}'`,
    `font-weight:${layer.weight}`,
    `font-size:${layer.size}px`,
    `line-height:${layer.lineHeight}`,
    `color:${layer.color}`,
    `text-align:${layer.align}`,
    layer.letterSpacing ? `letter-spacing:${layer.letterSpacing}em` : '',
    layer.shadow ? 'text-shadow:0 2px 18px rgba(0,0,0,.45)' : '',
  ].filter(Boolean).join(';');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${vbW} ${vbH}">` +
      `<foreignObject x="0" y="0" width="${vbW}" height="${vbH}">` +
        `<div xmlns="http://www.w3.org/1999/xhtml" dir="${layer.dir || 'auto'}">` +
          `<style>${css}\n${TEXT_CSS}</style>` +
          `<div class="obj-text" style="${styleAttr}">${layer.html}</div>` +
        `</div>` +
      `</foreignObject>` +
    `</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const cvs = document.createElement('canvas');
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    if (isBlank(ctx, w, h)) throw new Error('foreignObject produced an empty raster');
    return cvs;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

/* Sample a grid of pixels; if everything is fully transparent the
   browser refused the foreignObject and we fall back to canvas text. */
function isBlank(ctx, w, h) {
  try {
    const d = ctx.getImageData(0, 0, w, h).data;
    const step = Math.max(4, Math.floor(d.length / 4 / 4000)) * 4;
    for (let i = 3; i < d.length; i += step) if (d[i] > 6) return false;
    return true;
  } catch (_) { return false; }
}

/** Fallback: lay the text out directly on a canvas. Loses per-run
    styling inside a line but always produces readable output. */
export function rasterizeTextFallback(layer) {
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  const lineH = layer.size * layer.lineHeight;
  const plain = richTextToPlain(layer.html);
  const font = `${layer.weight} ${layer.size}px "${layer.font}"`;

  ctx.font = font;
  const lines = [];
  for (const para of plain.split('\n')) {
    if (!para) { lines.push(''); continue; }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (ctx.measureText(test).width > layer.boxW && line.trim()) {
        lines.push(line.trimEnd()); line = word.trimStart();
      } else { line = test; }
    }
    lines.push(line.trimEnd());
  }

  cvs.width  = Math.max(2, Math.ceil(layer.boxW));
  cvs.height = Math.max(2, Math.ceil(lines.length * lineH));
  const c = cvs.getContext('2d');
  c.font = font;
  c.fillStyle = layer.color;
  c.textBaseline = 'middle';
  c.direction = /[\u0590-\u05FF\u0600-\u06FF]/.test(plain) ? 'rtl' : 'ltr';
  c.textAlign = layer.align === 'center' ? 'center' : (layer.align === 'right' ? 'right' : 'left');
  const x = layer.align === 'center' ? cvs.width / 2 : (layer.align === 'right' ? cvs.width : 0);
  lines.forEach((ln, i) => c.fillText(ln, x, i * lineH + lineH / 2));
  return cvs;
}

/* ============================================================
   Media samplers — seek a source to an exact time, then draw
   ============================================================ */

export function createVideoEl(sources, { muted = true } = {}) {
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.playsInline = true;
  v.muted = muted;
  v.loop = true;
  v.preload = 'auto';
  v.setAttribute('playsinline', '');
  (Array.isArray(sources) ? sources : [sources]).filter(Boolean).forEach((src) => {
    const s = document.createElement('source');
    s.src = src;
    if (/\.webm(\?|#|$)/i.test(src)) s.type = 'video/webm';
    else if (/\.mp4|\.m4v(\?|#|$)/i.test(src)) s.type = 'video/mp4';
    else if (/\.mov(\?|#|$)/i.test(src)) s.type = 'video/quicktime';
    v.appendChild(s);
  });
  v.load();
  return v;
}

export function whenVideoReady(v, timeout = 25000) {
  return new Promise((resolve, reject) => {
    if (v.readyState >= 2 && v.videoWidth) return resolve(v);
    const done = () => { cleanup(); v.videoWidth ? resolve(v) : reject(new Error('Video has no picture')); };
    const fail = () => { cleanup(); reject(new Error('Video could not be loaded')); };
    const cleanup = () => {
      v.removeEventListener('loadeddata', done);
      v.removeEventListener('error', fail);
      clearTimeout(t);
    };
    const t = setTimeout(() => { cleanup(); reject(new Error('Video timed out')); }, timeout);
    v.addEventListener('loadeddata', done);
    v.addEventListener('error', fail);
  });
}

/** Deterministic frame access for export. Seeking a paused element is
    slower than playback but is the only reliably exact method. */
export function makeSampler(el, { loop = false } = {}) {
  const isVideo = el instanceof HTMLVideoElement;
  return {
    el,
    get w() { return isVideo ? el.videoWidth  : el.naturalWidth  || el.width; },
    get h() { return isVideo ? el.videoHeight : el.naturalHeight || el.height; },
    async seek(t) {
      if (!isVideo) return;
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : t + 1;
      /* a clip shorter than the template repeats instead of freezing */
      const local = loop && dur > 0.05 ? t % dur : t;
      const target = Math.max(0, Math.min(local, dur - 1 / 1000));
      if (Math.abs(el.currentTime - target) < 1e-4 && el.readyState >= 2) return;
      await new Promise((resolve) => {
        let settled = false;
        const ok = () => { if (settled) return; settled = true; clean(); resolve(); };
        const clean = () => { el.removeEventListener('seeked', ok); clearTimeout(timer); };
        const timer = setTimeout(ok, 3000);
        el.addEventListener('seeked', ok);
        try { el.currentTime = target; } catch (_) { ok(); }
      });
    },
  };
}

/** Draw a source across the whole frame, cropping the overflow. */
export function drawCover(ctx, src, sw, sh, dw, dh) {
  if (!sw || !sh) return;
  const s = Math.max(dw / sw, dh / sh);
  const w = sw * s, h = sh * s;
  ctx.drawImage(src, (dw - w) / 2, (dh - h) / 2, w, h);
}

/* ============================================================
   Frame compositor — background, middle layer, foreground
   ============================================================ */

export function composeFrame(ctx, comp, parts) {
  const { width: W, height: H } = comp;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  if (parts.bg) drawCover(ctx, parts.bg.el, parts.bg.w, parts.bg.h, W, H);

  if (parts.mid && parts.midT) {
    const t = parts.midT;
    const el = parts.mid.el || parts.mid;
    const nw = parts.mid.w || el.width;
    const nh = parts.mid.h || el.height;
    if (nw && nh) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate((t.rotation || 0) * Math.PI / 180);
      ctx.scale(t.scale || 1, t.scale || 1);
      if (t.opacity != null) ctx.globalAlpha = t.opacity;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(el, -t.w / 2, -t.h / 2, t.w, t.h);
      ctx.restore();
    }
  }

  if (parts.fg) drawCover(ctx, parts.fg.el, parts.fg.w, parts.fg.h, W, H);
  ctx.restore();
}

/* ============================================================
   Encoder support + configuration
   ============================================================ */

export function exportSupport() {
  const hasCodecs = typeof window !== 'undefined' &&
    'VideoEncoder' in window && 'VideoFrame' in window;
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  return { mp4: hasCodecs, webm: hasRecorder, any: hasCodecs || hasRecorder };
}

export const QUALITY = {
  standard: { bpp: 0.11, label: 'Standard' },
  high:     { bpp: 0.24, label: 'High' },
  max:      { bpp: 0.40, label: 'Maximum' },
};

export function bitrateFor(w, h, fps, quality = 'high') {
  const bpp = (QUALITY[quality] || QUALITY.high).bpp;
  return Math.round(Math.min(80e6, Math.max(2.5e6, w * h * fps * bpp)));
}

/* Try progressively more permissive H.264 levels, then fall back. */
const AVC_CANDIDATES = [
  'avc1.640034', /* High 5.2 */
  'avc1.640033', /* High 5.1 */
  'avc1.640032', /* High 5.0 */
  'avc1.64002A', /* High 4.2 */
  'avc1.640028', /* High 4.0 */
  'avc1.4D4028', /* Main 4.0 */
  'avc1.42E028', /* Baseline 4.0 */
];

export async function pickVideoConfig(width, height, fps, bitrate) {
  for (const codec of AVC_CANDIDATES) {
    const config = {
      codec, width, height, bitrate, framerate: fps,
      latencyMode: 'quality',
      avc: { format: 'avc' },
    };
    try {
      const r = await VideoEncoder.isConfigSupported(config);
      if (r && r.supported) return r.config || config;
    } catch (_) { /* try next */ }
  }
  return null;
}

/* ============================================================
   Audio — decode, mix and encode to AAC
   ============================================================ */

async function decodeAudio(url, ac) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('Audio fetch failed');
  return ac.decodeAudioData(await res.arrayBuffer());
}

/** Mix the chosen sources down to one buffer of exactly `duration`. */
async function buildAudioBuffer(sources, duration, sampleRate = 48000) {
  const probe = new (window.AudioContext || window.webkitAudioContext)();
  const buffers = [];
  for (const s of sources) {
    try {
      const buf = await decodeAudio(s.url, probe);
      if (buf && buf.length) buffers.push({ buf, gain: s.gain ?? 1 });
    } catch (e) { console.warn('Audio skipped:', s.url, e.message); }
  }
  probe.close?.();
  if (!buffers.length) return null;

  const frames = Math.ceil(duration * sampleRate);
  const offline = new OfflineAudioContext(2, frames, sampleRate);
  for (const { buf, gain } of buffers) {
    const src = offline.createBufferSource();
    src.buffer = buf;
    src.loop = buf.duration < duration - 0.05;   /* short beds loop to fill */
    const g = offline.createGain();
    g.gain.value = gain;
    src.connect(g).connect(offline.destination);
    src.start(0);
    src.stop(duration);
  }
  return offline.startRendering();
}

async function encodeAudioTrack(audioBuf, muxer, onError) {
  const sampleRate = audioBuf.sampleRate;
  const channels = Math.min(2, audioBuf.numberOfChannels);
  const CHUNK = 1024;

  const cfg = { codec: 'mp4a.40.2', sampleRate, numberOfChannels: channels, bitrate: 192000 };
  try {
    const ok = await AudioEncoder.isConfigSupported(cfg);
    if (!ok || !ok.supported) return false;
  } catch (_) { return false; }

  const enc = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => onError?.(e),
  });
  enc.configure(cfg);

  const chData = [];
  for (let c = 0; c < channels; c++) chData.push(audioBuf.getChannelData(c));

  for (let off = 0; off < audioBuf.length; off += CHUNK) {
    const n = Math.min(CHUNK, audioBuf.length - off);
    const planar = new Float32Array(n * channels);
    for (let c = 0; c < channels; c++) planar.set(chData[c].subarray(off, off + n), c * n);
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: n,
      numberOfChannels: channels,
      timestamp: Math.round((off / sampleRate) * 1e6),
      data: planar,
    });
    enc.encode(data);
    data.close();
    if (enc.encodeQueueSize > 24) await enc.flush();
  }
  await enc.flush();
  enc.close();
  return true;
}

/* ============================================================
   Exporter
   ============================================================ */

/**
 * Render the composition to an MP4.
 * @param {object} job
 *   comp     {width,height,fps,duration}
 *   bg,fg    sampler|null
 *   mid      { sampler|canvas, transform }|null
 *   audio    [{url,gain}]
 *   quality  'standard'|'high'|'max'
 *   onProgress(fraction, stage)
 *   signal   AbortSignal
 */
export async function exportMP4(job) {
  const { comp, bg, fg, mid, quality = 'high', onProgress, signal } = job;
  const W = comp.width, H = comp.height, fps = comp.fps;
  const total = Math.max(1, Math.round(comp.duration * fps));

  const support = exportSupport();
  if (!support.mp4) throw new Error('NO_WEBCODECS');

  const bitrate = bitrateFor(W, H, fps, quality);
  const config = await pickVideoConfig(W, H, fps, bitrate);
  if (!config) throw new Error('This browser cannot encode H.264 at ' + W + '×' + H + '.');

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  /* Decode and mix the audio before configuring the muxer. Declaring an
     audio track we then fail to fill leaves a valid-looking but empty
     track that some players choke on. */
  let audioBuf = null;
  if (job.audio && job.audio.length && typeof AudioEncoder !== 'undefined') {
    onProgress?.(0, 'audio');
    try {
      audioBuf = await buildAudioBuffer(job.audio, comp.duration, 48000);
    } catch (e) { console.warn('Audio skipped:', e); }
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    ...(audioBuf ? { audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } } : {}),
    fastStart: 'in-memory',
  });

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e; },
  });
  encoder.configure(config);

  const gopSize = Math.max(1, Math.round(fps * 2));
  const frameDur = Math.round(1e6 / fps);

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) { try { encoder.close(); } catch (_) {} throw new DOMException('Aborted', 'AbortError'); }
    if (encoderError) throw encoderError;

    const t = i / fps;
    if (bg) await bg.seek(t);
    if (fg) await fg.seek(t);
    if (mid && mid.sampler) await mid.sampler.seek(t);

    composeFrame(ctx, comp, {
      bg: bg ? { el: bg.el, w: bg.w, h: bg.h } : null,
      fg: fg ? { el: fg.el, w: fg.w, h: fg.h } : null,
      mid: mid ? (mid.sampler
        ? { el: mid.sampler.el, w: mid.sampler.w, h: mid.sampler.h }
        : { el: mid.canvas, w: mid.canvas.width, h: mid.canvas.height }) : null,
      midT: mid ? mid.transform : null,
    });

    const frame = new VideoFrame(canvas, { timestamp: i * frameDur, duration: frameDur });
    encoder.encode(frame, { keyFrame: i % gopSize === 0 });
    frame.close();

    if (encoder.encodeQueueSize > 6) {
      await new Promise((r) => setTimeout(r, 0));
      while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 8));
    }
    onProgress?.((i + 1) / total * (audioBuf ? 0.9 : 1), 'video');
  }

  await encoder.flush();
  encoder.close();
  if (encoderError) throw encoderError;

  if (audioBuf) {
    onProgress?.(0.93, 'audio');
    try {
      await encodeAudioTrack(audioBuf, muxer, (e) => console.warn('Audio encoder:', e));
    } catch (e) { console.warn('Audio track skipped:', e); }
    onProgress?.(0.99, 'audio');
  }

  muxer.finalize();
  onProgress?.(1, 'done');
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

/* ---------- WebM fallback for browsers without WebCodecs ---------- */

export async function exportWebMFallback(job) {
  const { comp, bg, fg, mid, onProgress, signal } = job;
  const W = comp.width, H = comp.height, fps = comp.fps;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('This browser cannot record video.');

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrateFor(W, H, fps, 'high') });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  rec.start();

  const total = Math.max(1, Math.round(comp.duration * fps));
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) { rec.stop(); throw new DOMException('Aborted', 'AbortError'); }
    const t = i / fps;
    if (bg) await bg.seek(t);
    if (fg) await fg.seek(t);
    if (mid && mid.sampler) await mid.sampler.seek(t);
    composeFrame(ctx, comp, {
      bg: bg ? { el: bg.el, w: bg.w, h: bg.h } : null,
      fg: fg ? { el: fg.el, w: fg.w, h: fg.h } : null,
      mid: mid ? (mid.sampler
        ? { el: mid.sampler.el, w: mid.sampler.w, h: mid.sampler.h }
        : { el: mid.canvas, w: mid.canvas.width, h: mid.canvas.height }) : null,
      midT: mid ? mid.transform : null,
    });
    track.requestFrame?.();
    await new Promise((r) => setTimeout(r, 0));
    onProgress?.((i + 1) / total, 'video');
  }
  rec.stop();
  await stopped;
  return new Blob(chunks, { type: 'video/webm' });
}
