/* Boots the real index.html under jsdom and drives the three steps.
   Catches missing elements, typo'd selectors and wiring errors.
   Run: node test/app.dom.test.mjs                                     */

import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const root = new URL('..', import.meta.url);
const html = fs.readFileSync(new URL('index.html', root), 'utf8');
const presets = fs.readFileSync(new URL('presets.json', root), 'utf8');

const dom = new JSDOM(html, { url: 'https://example.test/', pretendToBeVisual: true });
const { window } = dom;

for (const k of ['window', 'document', 'DOMParser', 'Node', 'NodeFilter', 'Range',
                 'HTMLVideoElement', 'Event', 'Image', 'getComputedStyle',
                 'requestAnimationFrame', 'cancelAnimationFrame']) {
  globalThis[k] = k === 'window' ? window : window[k];
}
for (const k of ['navigator', 'localStorage', 'location']) {
  Object.defineProperty(globalThis, k, { value: window[k], configurable: true });
}
window.ResizeObserver = globalThis.ResizeObserver = class { observe() {} disconnect() {} };
window.document.fonts = { load: async () => {}, ready: Promise.resolve() };
window.HTMLMediaElement.prototype.load = function () {};
window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
window.HTMLMediaElement.prototype.pause = function () {};
window.URL.createObjectURL = () => 'blob:fake';
window.URL.revokeObjectURL = () => {};
globalThis.fetch = async (url) => String(url).includes('presets.json')
  ? { ok: true, json: async () => JSON.parse(presets) }
  : { ok: false };

const errors = [];
window.addEventListener('error', (e) => errors.push(e.message));
const realError = console.error;
const isNodeNoise = (m) => /^\(node:\d+\)/.test(m) || /MODULE_TYPELESS|Reparsing|Not implemented/.test(m);
console.error = (...a) => {
  const m = a.map(String).join(' ');
  if (!isNodeNoise(m)) errors.push(m);
  realError(...a);
};

await import('../assets/js/app.js');
const settle = () => new Promise(r => setTimeout(r, 60));
await settle();

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
};
const $  = (s) => window.document.querySelector(s);
const $$ = (s) => [...window.document.querySelectorAll(s)];
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const group = (n) => console.log('\n' + n);

/* ---------------------------------------------------------- */
group('boot');
ok('no uncaught errors during boot', errors.length === 0, errors.join(' | '));
ok('three steps rendered', $$('.step').length === 3);
ok('step 1 open by default', $('.step[data-step="1"]').dataset.open === 'true');
ok('step 2 locked until a template is picked', $('.step[data-step="2"] .head').disabled === true);
ok('step 3 locked until a template is picked', $('.step[data-step="3"] .head').disabled === true);
ok('templates listed from presets.json', $$('.preset').length === 3,
   String($$('.preset').length));
ok('template card shows the format', /1080×1920/.test($('.preset .pdim').textContent));

/* ---------------------------------------------------------- */
group('picking a template');
click($('.preset[data-id="story"]'));
await settle();

ok('template marked as chosen', $('.preset[data-id="story"]').getAttribute('aria-pressed') === 'true');
ok('step 1 shows a summary', /Story/.test($('.step[data-step="1"] .s').textContent),
   $('.step[data-step="1"] .s').textContent);
ok('step 2 unlocked', $('.step[data-step="2"] .head').disabled === false);
ok('step 3 unlocked', $('.step[data-step="3"] .head').disabled === false);
ok('step 2 opened automatically', $('.step[data-step="2"]').dataset.open === 'true');
ok('stage built at composition size', $('.stage')?.style.width === '1080px',
   $('.stage')?.style.width);
ok('background layer present', !!$('.stage .lay-bg'));
ok('alpha overlay present', !!$('.stage .lay-fg'));
ok('overlay carries the pass-through class', $('.stage .lay-fg').classList.contains('lay-fg'));
ok('stylesheet makes the overlay pass pointer events through',
   /\.stage \.lay-fg\s*\{[^}]*pointer-events:\s*none/.test(
     fs.readFileSync(new URL('assets/css/app.css', root), 'utf8')));
ok('transport shown for a video template', !$('#transport').classList.contains('hidden'));
ok('export summary filled', /1080×1920/.test($('#exportSummary').textContent),
   $('#exportSummary').textContent);
ok('no errors after selecting', errors.length === 0, errors.join(' | '));

/* every id the code reaches for must exist once a template is loaded
   (clearSel only renders while text is selected, so it is exempt) */
const appSrc = fs.readFileSync(new URL('assets/js/app.js', root), 'utf8');
const ids = [...new Set([...appSrc.matchAll(/\$\('#([\w-]+)'\)/g)].map(m => m[1]))]
  .filter(id => id !== 'clearSel');
const missing = ids.filter(id => !window.document.getElementById(id));
ok('no dangling id selectors', missing.length === 0, missing.join(', '));

/* ---------------------------------------------------------- */
group('text mode');
click($('#modeText'));
await settle();

const obj = $('.obj-text');
ok('text object mounted between the layers', !!obj);
ok('it lives inside the middle host', obj?.parentElement.classList.contains('mid-host'));
ok('it is editable', obj?.getAttribute('contenteditable') === 'true');
ok('seeded with the template placeholder', /Your message here/.test(obj?.textContent || ''),
   obj?.textContent);
ok('default typeface is Ezer Standard', /Ezer Standard/.test(obj?.style.fontFamily || ''),
   obj?.style.fontFamily);
ok('default weight is SemiBold (500)', obj?.style.fontWeight === '500', obj?.style.fontWeight);
ok('default colour is F3F3F3',
   (obj?.style.color || '').replace(/\s/g, '') === 'rgb(243,243,243)', obj?.style.color);
ok('size derived from the template (8.5% of 1080)', obj?.style.fontSize === '92px', obj?.style.fontSize);
ok('box width derived from the template', obj?.style.width === '842.4px', obj?.style.width);
ok('textarea mirrors the text', $('#textInput').value === 'Your message here', $('#textInput').value);
ok('weight options rendered', $$('#weightSeg button').length === 4,
   String($$('#weightSeg button').length));
ok('weight labels are names not numbers', /Light|Book|Regular|SemiBold/.test($('#weightSeg').textContent));
ok('typeface options rendered', $$('#fontSeg button').length === 2);
ok('colour swatches rendered', $$('#swatches .sw').length === 7,
   String($$('#swatches .sw').length));

/* typing in the rail updates the video */
const ta = $('#textInput');
ta.value = 'Spring sale\n50% off';
ta.dispatchEvent(new window.Event('input', { bubbles: true }));
await settle();
ok('typing reaches the stage', /Spring sale/.test($('.obj-text').textContent), $('.obj-text').textContent);
ok('line breaks become blocks', $$('.obj-text div').length === 2,
   String($$('.obj-text div').length));
ok('step 2 marked done', $('.step[data-step="2"]').dataset.done === 'true');
ok('file name suggested from the text', /spring-sale/.test($('#fileName').value), $('#fileName').value);

/* changing the typeface with nothing selected restyles everything */
click($$('#fontSeg button').find(b => b.dataset.font === 'Gestura Text'));
await settle();
ok('typeface switched', /Gestura Text/.test($('.obj-text').style.fontFamily), $('.obj-text').style.fontFamily);
ok('Gestura is set italic', $('.obj-text').style.fontStyle === 'italic');
ok('weight maps to the nearest the family offers',
   $('.obj-text').style.fontWeight === '900', $('.obj-text').style.fontWeight);
ok('weight control collapses to one option', $$('#weightSeg button').length === 1);

click($$('#fontSeg button').find(b => b.dataset.font === 'Ezer Standard'));
await settle();
ok('switching back restores Ezer', /Ezer Standard/.test($('.obj-text').style.fontFamily));
ok('switching back lands on SemiBold, not Light',
   $('.obj-text').style.fontWeight === '500', $('.obj-text').style.fontWeight);
ok('switching back drops the italic', $('.obj-text').style.fontStyle === 'normal');

/* colour */
click($('.sw[data-c="#FF4A1C"]'));
await settle();
ok('colour applied to the block',
   $('.obj-text').style.color.replace(/\s/g, '') === 'rgb(255,74,28)', $('.obj-text').style.color);

/* alignment */
click($('#alignSeg button[data-align="left"]'));
await settle();
ok('alignment applied', $('.obj-text').style.textAlign === 'left');

/* size slider */
const sr = $('#sizeRange');
sr.value = '12';
sr.dispatchEvent(new window.Event('input', { bubbles: true }));
await settle();
ok('size slider drives font-size', $('.obj-text').style.fontSize === '130px', $('.obj-text').style.fontSize);

ok('still no errors', errors.length === 0, errors.join(' | '));

/* ---------------------------------------------------------- */
group('per-word styling');
const target = $('.obj-text').firstChild;          /* <div>Spring sale</div> */
const range = window.document.createRange();
range.setStart(target.firstChild, 0);
range.setEnd(target.firstChild, 6);                /* "Spring" */
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);
window.document.dispatchEvent(new window.Event('selectionchange'));
await settle();

ok('selection is noticed', /1 selected word|selected words/.test($('#selNote').textContent),
   $('#selNote').textContent);

click($$('#weightSeg button').find(b => b.dataset.w === '250'));
await settle();
const spans = $$('.obj-text span[style]');
ok('a run span was created', spans.length >= 1, String(spans.length));
ok('only the selected word is restyled', spans[0]?.textContent === 'Spring', spans[0]?.textContent);
ok('the run carries the new weight', /250/.test(spans[0]?.style.fontWeight || ''), spans[0]?.style.fontWeight);
ok('the block keeps its own weight', $('.obj-text').style.fontWeight === '500',
   $('.obj-text').style.fontWeight);
ok('the words are unchanged', $('.obj-text').textContent.startsWith('Spring sale'),
   $('.obj-text').textContent);
ok('textarea locks once runs are styled', $('#textInput').readOnly === true);
ok('a note explains why', !$('#styledNote').classList.contains('hidden'));

click($('#clearStyling'));
await settle();
ok('reset removes the run styling', $$('.obj-text span[style]').length === 0);
ok('reset keeps the words', $('.obj-text').textContent.startsWith('Spring sale'));
ok('textarea unlocks', $('#textInput').readOnly === false);

/* ---------------------------------------------------------- */
group('placement helpers');
click($('#btnCentre'));
await settle();
ok('centring writes a transform', /translate/.test($('.obj-text').style.transform),
   $('.obj-text').style.transform);
click($('#btnReset'));
await settle();
ok('reset clears rotation and scale',
   /rotate\(0deg\) scale\(1\)/.test($('.obj-text').style.transform), $('.obj-text').style.transform);

/* ---------------------------------------------------------- */
group('switching to upload mode');
click($('#modeMedia'));
await settle();
ok('drop zone shown', !$('#dropZone').classList.contains('hidden'));
ok('text panel hidden', $('#textPanel').style.display === 'none');
ok('no text object left on the stage', !$('.obj-text'));

click($('#modeText'));
await settle();
ok('text comes back with its content', /Spring sale/.test($('.obj-text')?.textContent || ''),
   $('.obj-text')?.textContent);

/* ---------------------------------------------------------- */
group('switching template keeps the work');
click($('.preset[data-id="landscape"]'));
await settle();
ok('stage rebuilt at the new size', $('.stage').style.width === '1920px', $('.stage').style.width);
ok('text survived the switch', /Spring sale/.test($('.obj-text')?.textContent || ''));
ok('export summary updated', /1920×1080/.test($('#exportSummary').textContent),
   $('#exportSummary').textContent);
ok('no errors overall', errors.length === 0, errors.join(' | '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
