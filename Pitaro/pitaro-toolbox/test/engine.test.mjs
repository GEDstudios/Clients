/* Headless checks for the Pitaro Toolbox engine.
   Run: node test/engine.test.mjs                        */

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://example.test/' });
for (const k of ['window', 'document', 'DOMParser', 'Node', 'NodeFilter', 'Range', 'HTMLVideoElement']) {
  globalThis[k] = k === 'window' ? dom.window : dom.window[k];
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, configurable: true });
Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true });
globalThis.fetch = async () => { throw new Error('offline'); };
dom.window.document.fonts = { load: async () => {}, ready: Promise.resolve() };

const E = await import('../assets/js/engine.js');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${a}\n        want ${b}`); }
};
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};
const group = (n) => console.log('\n' + n);

/* ---------------------------------------------------------- */
group('sanitizeRichText');

eq('keeps allowed runs',
  E.sanitizeRichText('<div>hello <span style="font-weight:500">world</span></div>'),
  '<div>hello <span style="font-weight:500">world</span></div>');

ok('drops script elements entirely',
  !/script|alert/i.test(E.sanitizeRichText('<div>hi<script>alert(1)<\/script></div>')),
  E.sanitizeRichText('<div>hi<script>alert(1)<\/script></div>'));

ok('strips event handler attributes',
  !/onerror|onclick/i.test(E.sanitizeRichText('<div onclick="x()">hi</div>')));

ok('drops img and keeps surrounding text',
  !/img/i.test(E.sanitizeRichText('<div>a<img src=x onerror=alert(1)>b</div>')));

eq('unwraps unknown tags but keeps the words',
  E.sanitizeRichText('<article><div>keep me</div></article>'),
  '<div>keep me</div>');

ok('rejects url() in styles',
  !/url/i.test(E.sanitizeRichText('<span style="font-family:url(evil)">x</span>')));

ok('rejects javascript: in styles',
  !/javascript/i.test(E.sanitizeRichText('<span style="color:javascript:x">x</span>')));

eq('keeps only whitelisted style properties',
  E.sanitizeRichText('<span style="color:#fff;position:fixed;top:0">x</span>'),
  '<span style="color:rgb(255, 255, 255)">x</span>');

ok('is idempotent', (() => {
  const once = E.sanitizeRichText('<div>a<span style="color:#F3F3F3">b</span></div>');
  return E.sanitizeRichText(once) === once;
})());

/* ---------------------------------------------------------- */
group('richTextToPlain');

eq('joins block lines', E.richTextToPlain('<div>a</div><div>b</div>'), 'a\nb');
eq('preserves a blank line', E.richTextToPlain('<div>a</div><div><br></div><div>b</div>'), 'a\n\nb');
eq('handles br inside a block', E.richTextToPlain('<div>a<br>b</div>'), 'a\nb');
eq('handles bare text', E.richTextToPlain('hello'), 'hello');
eq('reads through styled runs',
  E.richTextToPlain('<div><span style="font-weight:250">Big</span> news</div>'), 'Big news');
eq('empty input', E.richTextToPlain(''), '');

/* ---------------------------------------------------------- */
group('plain / rich round trip');

const plainToHTML = (t) => String(t).split('\n')
  .map(l => `<div>${l ? E.esc(l) : '<br>'}</div>`).join('');

for (const sample of ['one line', 'two\nlines', 'a\n\nb', 'עברית\nמימין לשמאל', 'a & b < c']) {
  eq(`round trip ${JSON.stringify(sample)}`,
    E.richTextToPlain(plainToHTML(sample)), sample);
}

ok('escaping survives the round trip',
  E.richTextToPlain(plainToHTML('<script>')) === '<script>');

/* ---------------------------------------------------------- */
group('hasRunStyling');

ok('false for uniform text', !E.hasRunStyling('<div>plain</div>'));
ok('true once a run is styled', E.hasRunStyling('<div><span style="color:red">x</span></div>'));

/* ---------------------------------------------------------- */
group('normalisePreset');

const n = E.normalisePreset({ id: 'x', width: 1081, height: 1921, fps: 999, duration: -4 });
eq('forces even width (H.264)', n.width % 2, 0);
eq('forces even height (H.264)', n.height % 2, 0);
eq('clamps fps', n.fps, 60);
eq('clamps duration', n.duration, 0.1);
eq('keeps the id', n.id, 'x');
eq('fills text defaults', n.text.color, '#F3F3F3');
eq('default weight is SemiBold', n.text.weight, 500);
eq('default family', n.text.font, 'Ezer Standard');
ok('fills allow flags', n.allow.text === true && n.allow.upload === true);

const partial = E.normalisePreset({ id: 'y', text: { size: 0.2 } });
eq('merges partial text without losing siblings', partial.text.align, 'center');
eq('keeps the supplied value', partial.text.size, 0.2);

const round = E.normalisePreset(JSON.parse(JSON.stringify(E.normalisePreset({ id: 'z' }))));
eq('normalise is stable', round, E.normalisePreset({ id: 'z' }));

/* ---------------------------------------------------------- */
group('published presets.json');

const fs = await import('node:fs');
const raw = JSON.parse(fs.readFileSync(new URL('../presets.json', import.meta.url), 'utf8'));
ok('is an array', Array.isArray(raw));
for (const p of raw) {
  const np = E.normalisePreset(p);
  ok(`${p.id}: survives normalisation unchanged`,
    np.width === p.width && np.height === p.height && np.fps === p.fps,
    `${np.width}x${np.height}@${np.fps}`);
  ok(`${p.id}: media paths are relative`,
    [p.background, p.foreground, p.poster].every(v => !v || !v.startsWith('/')));
  ok(`${p.id}: foreground is a webm (alpha-capable)`, !p.foreground || p.foreground.endsWith('.webm'));
  ok(`${p.id}: files exist on disk`,
    [p.background, p.foreground, p.poster].filter(Boolean).every(v =>
      fs.existsSync(new URL('../' + v, import.meta.url))));
  ok(`${p.id}: text sits inside the frame`, p.text.x >= 0 && p.text.x <= 1 && p.text.y >= 0 && p.text.y <= 1);
}

/* ---------------------------------------------------------- */
group('helpers');

eq('slugify strips punctuation', E.slugify('Spring Sale — 50% off!'), 'spring-sale-50-off');
eq('slugify falls back', E.slugify('...'), 'pitaro-video');
ok('slugify caps length', E.slugify('x'.repeat(200)).length <= 60);
eq('isVideoSrc mp4', E.isVideoSrc('media/a.mp4'), true);
eq('isVideoSrc webm with query', E.isVideoSrc('media/a.webm?v=2'), true);
eq('isVideoSrc jpg', E.isVideoSrc('media/a.jpg'), false);
eq('esc escapes angle brackets', E.esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
eq('fmtTime', E.fmtTime(65.4), '1:05.4');
eq('fmtTime zero', E.fmtTime(0), '0:00.0');
eq('fmtBytes', E.fmtBytes(1536), '1.5 KB');

/* ---------------------------------------------------------- */
group('bitrate + encoder config');

const b1080 = E.bitrateFor(1080, 1920, 30, 'high');
ok('1080x1920 high is 10-20 Mbps', b1080 > 10e6 && b1080 < 20e6, String(b1080));
ok('standard is below high', E.bitrateFor(1080, 1920, 30, 'standard') < b1080);
ok('max is above high', E.bitrateFor(1080, 1920, 30, 'max') > b1080);
ok('4K stays under the ceiling', E.bitrateFor(3840, 2160, 30, 'max') <= 80e6);
ok('tiny frames get a floor', E.bitrateFor(64, 64, 30, 'standard') >= 2.5e6);
ok('exportSupport reports no codecs under jsdom', E.exportSupport().mp4 === false);

/* ---------------------------------------------------------- */
group('drawCover geometry');

const calls = [];
const fakeCtx = { drawImage: (_s, x, y, w, h) => calls.push({ x, y, w, h }) };

calls.length = 0;
E.drawCover(fakeCtx, {}, 1920, 1080, 1080, 1920);      /* landscape into portrait */
const c1 = calls[0];
ok('cover fills the height', Math.abs(c1.h - 1920) < 0.01, JSON.stringify(c1));
ok('cover overflows the width', c1.w > 1080);
ok('cover stays centred', Math.abs(c1.x + c1.w / 2 - 540) < 0.01);

calls.length = 0;
E.drawCover(fakeCtx, {}, 1080, 1080, 1920, 1080);      /* square into landscape */
const c2 = calls[0];
ok('cover fills the width', Math.abs(c2.w - 1920) < 0.01, JSON.stringify(c2));
ok('cover centres vertically', Math.abs(c2.y + c2.h / 2 - 540) < 0.01);

calls.length = 0;
E.drawCover(fakeCtx, {}, 0, 0, 1080, 1920);
eq('ignores a source with no dimensions', calls.length, 0);

/* ---------------------------------------------------------- */
group('composeFrame layer order');

const order = [];
const ctx2 = {
  save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, scale: () => {},
  fillRect: () => order.push('clear'), set fillStyle(_v) {}, get fillStyle() { return ''; },
  drawImage: function (s) { order.push(s.tag); },
  set globalAlpha(_v) {}, set imageSmoothingQuality(_v) {},
};
E.composeFrame(ctx2, { width: 1080, height: 1920 }, {
  bg:  { el: { tag: 'bg' }, w: 1080, h: 1920 },
  fg:  { el: { tag: 'fg' }, w: 1080, h: 1920 },
  mid: { el: { tag: 'mid' }, w: 500, h: 500 },
  midT: { x: 540, y: 960, w: 500, h: 500, scale: 1, rotation: 0 },
});
eq('paints background, middle, then foreground', order, ['clear', 'bg', 'mid', 'fg']);

order.length = 0;
E.composeFrame(ctx2, { width: 1080, height: 1920 }, {
  bg: { el: { tag: 'bg' }, w: 1080, h: 1920 }, fg: null, mid: null, midT: null,
});
eq('works with no middle layer and no overlay', order, ['clear', 'bg']);

/* ---------------------------------------------------------- */
group('makeSampler');

class FakeVideo extends dom.window.HTMLVideoElement {}
function fakeVideo(duration) {
  const v = dom.window.document.createElement('video');
  Object.defineProperty(v, 'duration', { value: duration, configurable: true });
  Object.defineProperty(v, 'readyState', { value: 4, configurable: true });
  let t = 0;
  Object.defineProperty(v, 'currentTime', {
    get: () => t,
    set: (val) => { t = val; setTimeout(() => v.dispatchEvent(new dom.window.Event('seeked')), 0); },
    configurable: true,
  });
  return v;
}

const v1 = fakeVideo(10);
const s1 = E.makeSampler(v1);
await s1.seek(3.5);
ok('seeks to the requested time', Math.abs(v1.currentTime - 3.5) < 1e-3, String(v1.currentTime));

const v2 = fakeVideo(2);
const s2 = E.makeSampler(v2, { loop: true });
await s2.seek(5.25);
ok('a short clip wraps instead of freezing',
  Math.abs(v2.currentTime - 1.25) < 1e-3, String(v2.currentTime));

const v3 = fakeVideo(2);
const s3 = E.makeSampler(v3);
await s3.seek(5.25);
ok('without loop it clamps to the end',
  Math.abs(v3.currentTime - 2) < 0.01, String(v3.currentTime));

/* ---------------------------------------------------------- */
group('transform maths (mirrors app.js)');

/* the object is translated so its centre lands on (x, y) */
const place = (x, y, w, h) => ({ tx: x - w / 2, ty: y - h / 2 });
eq('centres a text block', place(540, 768, 842, 300), { tx: 119, ty: 618 });
const p1 = place(540, 960, 756, 200);
ok('centre round trips', p1.tx + 756 / 2 === 540 && p1.ty + 200 / 2 === 960);

/* corner scaling is the ratio of pointer distances from the centre */
const scaleFrom = (s0, d0, d1) => Math.min(12, Math.max(0.05, s0 * (d1 / d0)));
eq('dragging out doubles the scale', scaleFrom(1, 100, 200), 2);
eq('scale has a floor', scaleFrom(1, 100, 0), 0.05);
eq('scale has a ceiling', scaleFrom(1, 1, 1000), 12);

/* rotation snaps to 15 degree steps with shift held */
const snapDeg = (d) => Math.round(d / 15) * 15;
eq('snaps 47 to 45', snapDeg(47), 45);
eq('snaps -8 to -15', snapDeg(-8), -15);

/* fraction <-> pixel conversions must survive a change of template */
const toPx = (frac, comp) => frac * comp;
eq('same fraction scales across formats',
  [toPx(0.5, 1080), toPx(0.5, 1920)], [540, 960]);
eq('text size tracks composition width', Math.round(toPx(0.085, 1080)), 92);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
