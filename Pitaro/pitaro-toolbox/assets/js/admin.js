/* ============================================================
   Pitaro Toolbox — template builder (admin only)
   Edits the preset list, previews it, and writes presets.json.
   ============================================================ */

import {
  blankPreset, normalisePreset, loadPresets, FONTS, SWATCHES,
  DEFAULT_COLOR, DEFAULT_FONT, DEFAULT_WEIGHT,
  createVideoEl, whenVideoReady, isVideoSrc, esc, download, slugify,
  ensureFontsReady,
} from './engine.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const KEY = 'pitaro.presets.draft';

const RATIOS = [
  { label: 'Story / Reel  9:16', w: 1080, h: 1920 },
  { label: 'Square  1:1',        w: 1080, h: 1080 },
  { label: 'Portrait  4:5',      w: 1080, h: 1350 },
  { label: 'Landscape  16:9',    w: 1920, h: 1080 },
  { label: 'Landscape 4K  16:9', w: 3840, h: 2160 },
];

const A = { presets: [], current: null, blobs: new Map(), scale: 1 };

boot().catch(e => { console.error(e); toast('Could not start the builder.'); });

async function boot() {
  ensureFontsReady();
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  A.presets = (Array.isArray(draft) && draft.length ? draft : await loadPresets()).map(normalisePreset);
  if (!A.presets.length) A.presets = [normalisePreset(blankPreset())];

  buildForm();
  renderList();
  selectPreset(A.presets[0].id);
  wireToolbar();
  window.addEventListener('resize', layoutPreview);
}

/* ============================================================
   Preset list
   ============================================================ */

function renderList() {
  const host = $('#plist');
  host.innerHTML = A.presets.map((p, i) => `
    <button class="pitem" data-id="${esc(p.id)}" draggable="true" aria-pressed="${p.id === A.current ? 'true' : 'false'}">
      <span class="drag" aria-hidden="true">⠿</span>
      <span class="pi-n">${esc(p.name || 'Untitled')}</span>
      <span class="pi-d">${p.width}×${p.height}</span>
    </button>`).join('');

  $$('.pitem', host).forEach((el) => {
    el.addEventListener('click', () => selectPreset(el.dataset.id));
    el.addEventListener('dragstart', (e) => {
      el.classList.add('dragging');
      e.dataTransfer.setData('text/plain', el.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = e.dataTransfer.getData('text/plain');
      const to = el.dataset.id;
      if (!from || from === to) return;
      const fi = A.presets.findIndex(p => p.id === from);
      const ti = A.presets.findIndex(p => p.id === to);
      const [moved] = A.presets.splice(fi, 1);
      A.presets.splice(ti, 0, moved);
      renderList(); markDirty();
    });
  });
  $('#count').textContent = `${A.presets.length} template${A.presets.length === 1 ? '' : 's'}`;
}

function selectPreset(id) {
  A.current = id;
  $$('.pitem').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === id ? 'true' : 'false'));
  fillForm(current());
  buildPreview();
}

const current = () => A.presets.find(p => p.id === A.current);

/* ============================================================
   Form
   ============================================================ */

function buildForm() {
  const fontOpts = FONTS.map(f => `<option value="${esc(f.css)}">${esc(f.label)}</option>`).join('');
  const ratioOpts = RATIOS.map((r, i) => `<option value="${i}">${esc(r.label)} — ${r.w}×${r.h}</option>`).join('')
    + '<option value="custom">Custom size…</option>';

  $('#editor').innerHTML = `
  <div class="card">
    <h3>Template</h3>
    <p class="cs">What your clients will see on the card.</p>
    <div class="field"><span class="label">Name</span><input type="text" id="f-name" placeholder="Spring sale — story"></div>
    <div class="field"><span class="label">Short note (optional)</span><input type="text" id="f-note" placeholder="For Instagram and TikTok stories"></div>
  </div>

  <div class="card">
    <h3>Format</h3>
    <p class="cs">Exports always match these numbers exactly.</p>
    <div class="field"><span class="label">Frame size</span><select id="f-ratio">${ratioOpts}</select></div>
    <div class="grid3" id="sizeRow">
      <div class="field"><span class="label">Width</span><input type="number" id="f-w" min="16" max="7680" step="2"></div>
      <div class="field"><span class="label">Height</span><input type="number" id="f-h" min="16" max="7680" step="2"></div>
      <div class="field"><span class="label">Frames / second</span><input type="number" id="f-fps" min="1" max="60" step="1"></div>
    </div>
    <div class="field"><span class="label">Duration (seconds)</span><input type="number" id="f-dur" min="0.1" max="600" step="0.1"></div>
    <div class="hint">Leave duration matched to your background clip so nothing freezes at the end.</div>
  </div>

  <div class="card">
    <h3>Layers</h3>
    <p class="cs">Put your files in the <code class="path">media/</code> folder of the repository, then reference them below. Drop a file on a box to fill in the path and read its size.</p>

    <div class="field">
      <span class="label">Background — bottom layer</span>
      <div class="row"><input type="text" id="f-bg" class="grow" placeholder="media/spring-bg.mp4"><button class="btn" data-pick="bg">Browse…</button></div>
      <div class="hint" id="bgInfo"></div>
    </div>

    <div class="field">
      <span class="label">Foreground with transparency — top layer</span>
      <div class="row"><input type="text" id="f-fg" class="grow" placeholder="media/spring-overlay.webm"><button class="btn" data-pick="fg">Browse…</button></div>
      <div class="hint">Export this as <strong>WebM · VP9 with an alpha channel</strong>. A ProRes 4444 or HEVC <code class="path">.mov</code> will not play in most browsers.</div>
    </div>

    <div class="field">
      <span class="label">Safari fallback for the foreground (optional)</span>
      <div class="row"><input type="text" id="f-fg2" class="grow" placeholder="media/spring-overlay.mov"><button class="btn" data-pick="fg2">Browse…</button></div>
      <div class="hint">HEVC with alpha in a <code class="path">.mov</code> container. Safari uses this; everything else uses the WebM.</div>
    </div>

    <div class="field">
      <span class="label">Card image (optional)</span>
      <div class="row"><input type="text" id="f-poster" class="grow" placeholder="media/spring-card.jpg"><button class="btn" data-pick="poster">Browse…</button></div>
    </div>

    <div class="field">
      <span class="label">Sound comes from</span>
      <select id="f-audio">
        <option value="background">The background layer</option>
        <option value="foreground">The foreground layer</option>
        <option value="none">No sound</option>
      </select>
    </div>
  </div>

  <div class="card">
    <h3>Where the text starts</h3>
    <p class="cs">Drag the sample on the preview, or use the sliders. Your clients can move it afterwards.</p>
    <div class="field"><span class="label">Placeholder message</span><input type="text" id="f-ph" placeholder="Your message here"></div>
    <div class="grid2">
      <div class="field"><span class="label">Typeface</span><select id="f-font">${fontOpts}</select></div>
      <div class="field"><span class="label">Weight</span><select id="f-weight"></select></div>
    </div>
    <div class="grid2">
      <div class="field"><span class="label">Text size — <span id="f-size-v"></span>% of width</span><input type="range" id="f-size" min="1" max="30" step="0.25"></div>
      <div class="field"><span class="label">Box width — <span id="f-bw-v"></span>% of frame</span><input type="range" id="f-bw" min="10" max="100" step="1"></div>
    </div>
    <div class="grid2">
      <div class="field"><span class="label">Alignment</span>
        <select id="f-align"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
      </div>
      <div class="field"><span class="label">Line spacing</span><input type="number" id="f-lh" min="0.8" max="2" step="0.01"></div>
    </div>
    <div class="field"><span class="label">Colour</span>
      <div class="swatches" id="f-swatches"></div>
    </div>
  </div>

  <div class="card">
    <h3>What clients can change</h3>
    <p class="cs">Switch things off to keep the tool simple and on-brand.</p>
    <label class="chk"><input type="checkbox" data-allow="text"> Add their own text</label>
    <label class="chk"><input type="checkbox" data-allow="upload"> Upload an image or video</label>
    <label class="chk"><input type="checkbox" data-allow="font"> Change the typeface and weight</label>
    <label class="chk"><input type="checkbox" data-allow="size"> Change the text size</label>
    <label class="chk"><input type="checkbox" data-allow="color"> Change the colour</label>
    <label class="chk"><input type="checkbox" data-allow="transform"> Scale and rotate their layer</label>
    <label class="chk"><input type="checkbox" data-allow="sound"> Turn the template's sound on or off</label>
  </div>

  <div class="card">
    <h3>Danger zone</h3>
    <div class="row">
      <button class="btn" id="btnDup">Duplicate this template</button>
      <button class="btn danger" id="btnDel">Delete this template</button>
    </div>
  </div>`;

  const sw = $('#f-swatches');
  sw.innerHTML = SWATCHES.map(c => `<button class="sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')
    + `<span class="sw sw-custom"><input type="color" id="f-color"></span>`;
  $$('.sw[data-c]', sw).forEach(b => b.addEventListener('click', () => { $('#f-color').value = b.dataset.c; onField(); }));

  /* generic wiring */
  $$('#editor input, #editor select').forEach((el) => {
    el.addEventListener('input', onField);
    el.addEventListener('change', onField);
  });

  $('#f-ratio').addEventListener('change', () => {
    const v = $('#f-ratio').value;
    if (v !== 'custom') {
      const r = RATIOS[+v];
      $('#f-w').value = r.w; $('#f-h').value = r.h;
    }
    onField();
  });

  $('#f-font').addEventListener('change', () => { fillWeights($('#f-font').value); onField(); });

  $$('[data-pick]').forEach(b => b.addEventListener('click', () => pickFile(b.dataset.pick)));
  ['f-bg', 'f-fg', 'f-fg2', 'f-poster'].forEach((id) => {
    const el = $('#' + id);
    el.addEventListener('dragover', (e) => { e.preventDefault(); });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const slot = { 'f-bg': 'bg', 'f-fg': 'fg', 'f-fg2': 'fg2', 'f-poster': 'poster' }[id];
      useFile(slot, e.dataTransfer.files[0]);
    });
  });

  $('#btnDup').addEventListener('click', duplicatePreset);
  $('#btnDel').addEventListener('click', deletePreset);
}

function fillWeights(fam) {
  const def = FONTS.find(f => f.css === fam) || FONTS[0];
  $('#f-weight').innerHTML = def.weights
    .map(w => `<option value="${w.v}">${esc(w.label)}</option>`).join('');
}

function fillForm(p) {
  if (!p) return;
  $('#f-name').value = p.name;
  $('#f-note').value = p.note || '';
  const idx = RATIOS.findIndex(r => r.w === p.width && r.h === p.height);
  $('#f-ratio').value = idx >= 0 ? String(idx) : 'custom';
  $('#f-w').value = p.width; $('#f-h').value = p.height;
  $('#f-fps').value = p.fps; $('#f-dur').value = p.duration;
  $('#f-bg').value = p.background || '';
  $('#f-fg').value = p.foreground || '';
  $('#f-fg2').value = p.foregroundAlt || '';
  $('#f-poster').value = p.poster || '';
  $('#f-audio').value = p.audio || 'background';

  $('#f-ph').value = p.text.placeholder || '';
  $('#f-font').value = p.text.font || DEFAULT_FONT;
  fillWeights($('#f-font').value);
  $('#f-weight').value = String(p.text.weight || DEFAULT_WEIGHT);
  $('#f-size').value = (p.text.size * 100).toFixed(2);
  $('#f-bw').value = Math.round(p.text.width * 100);
  $('#f-align').value = p.text.align || 'center';
  $('#f-lh').value = p.text.lineHeight || 1.15;
  $('#f-color').value = p.text.color || DEFAULT_COLOR;
  $('#f-size-v').textContent = (+$('#f-size').value).toFixed(1);
  $('#f-bw-v').textContent = $('#f-bw').value;

  $$('[data-allow]').forEach(c => { c.checked = !!p.allow[c.dataset.allow]; });
  $('#sizeRow').style.display = '';
}

function onField() {
  const p = current();
  if (!p) return;
  p.name = $('#f-name').value.trim() || 'Untitled';
  p.note = $('#f-note').value.trim();
  p.width = +$('#f-w').value || 1080;
  p.height = +$('#f-h').value || 1920;
  p.fps = +$('#f-fps').value || 30;
  p.duration = +$('#f-dur').value || 6;
  p.background = $('#f-bg').value.trim();
  p.foreground = $('#f-fg').value.trim();
  p.foregroundAlt = $('#f-fg2').value.trim();
  p.poster = $('#f-poster').value.trim();
  p.audio = $('#f-audio').value;

  p.text.placeholder = $('#f-ph').value;
  p.text.font = $('#f-font').value;
  p.text.weight = +$('#f-weight').value;
  p.text.size = (+$('#f-size').value) / 100;
  p.text.width = (+$('#f-bw').value) / 100;
  p.text.align = $('#f-align').value;
  p.text.lineHeight = +$('#f-lh').value || 1.15;
  p.text.color = $('#f-color').value;

  $$('[data-allow]').forEach(c => { p.allow[c.dataset.allow] = c.checked; });

  $('#f-size-v').textContent = (+$('#f-size').value).toFixed(1);
  $('#f-bw-v').textContent = $('#f-bw').value;

  Object.assign(p, normalisePreset(p));
  renderList();
  markDirty();
  refreshPreviewStyles();
}

/* ============================================================
   Files
   ============================================================ */

function pickFile(slot) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = slot === 'poster' ? 'image/*' : 'video/*,image/*';
  inp.onchange = () => useFile(slot, inp.files[0]);
  inp.click();
}

async function useFile(slot, file) {
  if (!file) return;
  const p = current();
  const path = 'media/' + file.name;
  const field = { bg: '#f-bg', fg: '#f-fg', fg2: '#f-fg2', poster: '#f-poster' }[slot];
  $(field).value = path;

  const url = URL.createObjectURL(file);
  const key = p.id + ':' + slot;
  if (A.blobs.has(key)) URL.revokeObjectURL(A.blobs.get(key));
  A.blobs.set(key, url);

  if (/^video\//.test(file.type)) {
    try {
      const v = document.createElement('video');
      v.src = url; v.muted = true; v.preload = 'metadata';
      await whenVideoReady(v);
      if (slot === 'bg') {
        $('#f-w').value = v.videoWidth - (v.videoWidth % 2);
        $('#f-h').value = v.videoHeight - (v.videoHeight % 2);
        $('#f-dur').value = (Math.round(v.duration * 10) / 10).toFixed(1);
        $('#bgInfo').textContent =
          `Read from the file: ${v.videoWidth}×${v.videoHeight}, ${v.duration.toFixed(2)}s. ` +
          `Remember to commit ${path} to the repository.`;
      }
    } catch (_) {
      $('#bgInfo').textContent = 'Could not read that file — check it plays in a browser.';
    }
  }
  onField();
  buildPreview();
  toast(`Path set to ${path} — upload the file to your repo's media folder.`);
}

/* ============================================================
   Preview
   ============================================================ */

function srcFor(p, slot, path) {
  return A.blobs.get(p.id + ':' + slot) || path || '';
}

function buildPreview() {
  const p = current();
  const fit = $('#pfit');
  fit.innerHTML = '';
  if (!p) return;

  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.id = 'pstage';
  stage.style.width = p.width + 'px';
  stage.style.height = p.height + 'px';
  fit.appendChild(stage);

  const bg = srcFor(p, 'bg', p.background);
  if (bg && (isVideoSrc(bg) || bg.startsWith('blob:'))) {
    const v = createVideoEl([bg]);
    v.className = 'lay lay-bg';
    v.autoplay = true;
    stage.appendChild(v);
    v.play().catch(() => {});
  } else if (bg) {
    const i = document.createElement('img');
    i.className = 'lay lay-bg'; i.src = bg; stage.appendChild(i);
  }

  const sample = document.createElement('div');
  sample.className = 'obj obj-text';
  sample.id = 'psample';
  sample.textContent = p.text.placeholder || 'Your message here';
  sample.style.zIndex = '2';        /* between the background and the overlay */
  stage.appendChild(sample);

  const fg = srcFor(p, 'fg', p.foreground);
  if (fg) {
    const v = createVideoEl([fg, srcFor(p, 'fg2', p.foregroundAlt)]);
    v.className = 'lay lay-fg';
    v.autoplay = true;
    stage.appendChild(v);
    v.play().catch(() => {});
  }

  sample.addEventListener('pointerdown', startSampleDrag);
  refreshPreviewStyles();
  layoutPreview();
}

function refreshPreviewStyles() {
  const p = current();
  const s = $('#psample');
  const stage = $('#pstage');
  if (!p || !s || !stage) return;
  stage.style.width = p.width + 'px';
  stage.style.height = p.height + 'px';
  s.textContent = p.text.placeholder || 'Your message here';
  s.style.width = (p.text.width * p.width) + 'px';
  s.style.fontFamily = `"${p.text.font}"`;
  s.style.fontWeight = p.text.weight;
  s.style.fontStyle = p.text.font === 'Gestura Text' ? 'italic' : 'normal';
  s.style.fontSize = (p.text.size * p.width) + 'px';
  s.style.lineHeight = p.text.lineHeight;
  s.style.color = p.text.color;
  s.style.textAlign = p.text.align;
  positionSample();
  layoutPreview();
}

function positionSample() {
  const p = current(); const s = $('#psample');
  if (!p || !s) return;
  const w = s.offsetWidth, h = s.offsetHeight;
  s.style.transform = `translate(${p.text.x * p.width - w / 2}px, ${p.text.y * p.height - h / 2}px)`;
}

function layoutPreview() {
  const p = current(); const stage = $('#pstage'); const fit = $('#pfit');
  if (!p || !stage) return;
  const host = $('.preview-host');
  const availW = Math.max(80, host.clientWidth - 32);
  const availH = Math.max(80, host.clientHeight - 32);
  const s = Math.min(availW / p.width, availH / p.height);
  A.scale = s;
  stage.style.transform = `scale(${s})`;
  fit.style.width = Math.round(p.width * s) + 'px';
  fit.style.height = Math.round(p.height * s) + 'px';
  positionSample();
}

function startSampleDrag(e) {
  e.preventDefault();
  const p = current();
  const stage = $('#pstage');
  const r = stage.getBoundingClientRect();
  const s = r.width / p.width;
  const start = { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  const t0 = { x: p.text.x, y: p.text.y };

  const move = (ev) => {
    const x = (ev.clientX - r.left) / s, y = (ev.clientY - r.top) / s;
    p.text.x = Math.min(1.2, Math.max(-0.2, t0.x + (x - start.x) / p.width));
    p.text.y = Math.min(1.2, Math.max(-0.2, t0.y + (y - start.y) / p.height));
    if (Math.abs(p.text.x - 0.5) < 0.012) p.text.x = 0.5;
    if (Math.abs(p.text.y - 0.5) < 0.012) p.text.y = 0.5;
    positionSample();
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    markDirty();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* ============================================================
   Toolbar
   ============================================================ */

function wireToolbar() {
  $('#btnAdd').addEventListener('click', () => {
    const p = normalisePreset(blankPreset());
    p.name = 'New template';
    A.presets.push(p);
    renderList(); selectPreset(p.id); markDirty();
  });

  $('#btnSave').addEventListener('click', () => { save(); toast('Draft saved in this browser.'); });

  $('#btnDownload').addEventListener('click', () => {
    save();
    const clean = A.presets.map(stripBlobs);
    download(new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }), 'presets.json');
    toast('presets.json downloaded — replace the file in your repository and push.');
  });

  $('#btnCopy').addEventListener('click', async () => {
    const clean = A.presets.map(stripBlobs);
    try {
      await navigator.clipboard.writeText(JSON.stringify(clean, null, 2));
      toast('JSON copied to the clipboard.');
    } catch (_) { toast('Copying was blocked — use Download instead.'); }
  });

  $('#btnImport').addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const txt = await inp.files[0].text();
        const data = JSON.parse(txt);
        const list = Array.isArray(data) ? data : (data.presets || []);
        if (!list.length) throw new Error('empty');
        A.presets = list.map(normalisePreset);
        renderList(); selectPreset(A.presets[0].id); markDirty();
        toast(`Loaded ${A.presets.length} templates.`);
      } catch (_) { toast('That file is not a presets.json.'); }
    };
    inp.click();
  });

  $('#btnTry').addEventListener('click', () => {
    save();
    window.open(`index.html?preview=1&t=${encodeURIComponent(A.current)}`, '_blank', 'noopener');
  });
}

function stripBlobs(p) {
  const c = JSON.parse(JSON.stringify(p));
  ['background', 'backgroundAlt', 'foreground', 'foregroundAlt', 'poster'].forEach((k) => {
    if (typeof c[k] === 'string' && c[k].startsWith('blob:')) c[k] = '';
  });
  return c;
}

function duplicatePreset() {
  const p = current(); if (!p) return;
  const copy = normalisePreset(JSON.parse(JSON.stringify(p)));
  copy.id = 'preset-' + Math.random().toString(36).slice(2, 8);
  copy.name = p.name + ' copy';
  A.presets.splice(A.presets.indexOf(p) + 1, 0, copy);
  renderList(); selectPreset(copy.id); markDirty();
}

function deletePreset() {
  const p = current(); if (!p) return;
  if (!confirm(`Delete “${p.name}”? This cannot be undone.`)) return;
  A.presets = A.presets.filter(x => x.id !== p.id);
  if (!A.presets.length) A.presets = [normalisePreset(blankPreset())];
  renderList(); selectPreset(A.presets[0].id); markDirty();
}

let saveTimer = null;
function markDirty() {
  $('#saveState').textContent = 'Unsaved changes';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 900);
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(A.presets.map(stripBlobs)));
    $('#saveState').textContent = 'Draft saved';
  } catch (_) { $('#saveState').textContent = 'Could not save locally'; }
}

let tt = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => el.classList.remove('on'), 4200);
}
