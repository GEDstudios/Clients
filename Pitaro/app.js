const $ = (id) => document.getElementById(id);

const FONT_NAMES = {
  EzerLight: 'EzerLight',
  EzerBook: 'EzerBook',
  EzerRegular: 'EzerRegular',
  EzerSemiBold: 'EzerSemiBold',
  Gestura: 'Gestura',
};

const state = {
  mode: 'text',
  x: 50,
  y: 50,
  width: 1000,
  scale: 100,
  fontSize: 80,
  color: '#F3F3F3',
  tracking: 0,
  lineHeight: 108,
  align: 'center',
  duration: 0,
  editing: false,
  mediaFile: null,
  mediaType: null,
  mediaUrl: null,
  mediaRatio: 1,
  templateReady: false,
  raf: null,
};

const stage = $('stage');
const object = $('object');
const objectContent = $('objectContent');
const editableText = $('editableText');
const bgVideo = $('bgVideo');
const fgVideo = $('fgVideo');
const mediaImage = $('mediaImage');
const mediaVideo = $('mediaVideo');
const selectionTag = document.querySelector('.selection-tag');
const mobileInspectorToggle = $('mobileInspectorToggle');
const mobileInspectorClose = $('mobileInspectorClose');
const mobileBackdrop = $('mobileBackdrop');
const mobileTextMode = $('mobileTextMode');
const mobileMediaMode = $('mobileMediaMode');
const mobileEditAction = $('mobileEditAction');
const mobileStyleAction = $('mobileStyleAction');
const mobileCenterAction = $('mobileCenterAction');
const mobileQuery = window.matchMedia('(max-width: 760px)');
let savedTextRange = null;
let pendingExport = null;

function openMobileInspector() {
  if (!mobileQuery.matches) return;
  const head = document.querySelector('.mobile-inspector-head strong');
  if (head) head.textContent = state.mode === 'text' ? 'Text style' : 'Media';
  document.body.classList.add('inspector-open');
  mobileInspectorToggle?.setAttribute('aria-expanded', 'true');
}
function closeMobileInspector() {
  document.body.classList.remove('inspector-open');
  mobileInspectorToggle?.setAttribute('aria-expanded', 'false');
}
mobileInspectorToggle?.addEventListener('click', openMobileInspector);
mobileInspectorClose?.addEventListener('click', closeMobileInspector);
mobileBackdrop?.addEventListener('click', closeMobileInspector);
$('exportSaveButton')?.addEventListener('click', async () => {
  if (!pendingExport) return;
  const { url, file } = pendingExport;
  try {
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'Toolbox video' });
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
    }
    $('exportOverlay').classList.add('is-hidden');
    URL.revokeObjectURL(url);
    pendingExport = null;
  } catch (error) {
    if (error?.name !== 'AbortError') showToast('Could not save the video.');
  }
});
mobileQuery.addEventListener?.('change', (e) => { if (!e.matches) closeMobileInspector(); });

function clamp(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function formatTime(value) {
  const t = Math.max(0, Number(value) || 0);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function updateStageUnit() {
  const unit = stage.clientWidth / 1080;
  stage.style.setProperty('--stage-unit', `${unit}px`);
  applyVisualState();
}

function animatedScaleAt(t) {
  return Math.max(0.1, (state.scale / 100) * (1 - 0.02 * Math.max(0, t)));
}

function applyVisualState(time = bgVideo.currentTime || 0) {
  object.style.left = `${state.x}%`;
  object.style.top = `${state.y}%`;
  object.style.width = `${(state.width / 1080) * 100}%`;
  object.style.transform = `translate(-50%, -50%) scale(${animatedScaleAt(time)})`;

  const unit = stage.clientWidth / 1080;
  editableText.style.fontSize = `${state.fontSize * unit}px`;
  editableText.style.color = state.color;
  editableText.style.letterSpacing = `${state.tracking * unit}px`;
  editableText.style.lineHeight = `${state.lineHeight / 100}`;
  editableText.style.textAlign = state.align;

  $('xField').value = Number(state.x.toFixed(1));
  $('yField').value = Number(state.y.toFixed(1));
  $('widthField').value = Math.round(state.width);
  $('scaleField').value = Math.round(state.scale);
  if ($('mobileWidthRange')) $('mobileWidthRange').value = Math.round(state.width);
  if ($('mobileWidthValue')) $('mobileWidthValue').textContent = `${Math.round(state.width)} px`;
}

function setMode(mode) {
  state.mode = mode;
  const text = mode === 'text';
  $('textMode').classList.toggle('is-active', text);
  $('mediaMode').classList.toggle('is-active', !text);
  $('textInspector').classList.toggle('is-hidden', !text);
  $('mediaInspector').classList.toggle('is-hidden', text);
  editableText.classList.toggle('is-hidden', !text);
  if (!text) exitTextEdit();
  updateMediaVisibility();
  object.dataset.mode = mode;
  selectionTag.textContent = text ? 'TEXT' : 'MEDIA';
  mobileTextMode?.classList.toggle('is-active', text);
  mobileMediaMode?.classList.toggle('is-active', !text);
  if (mobileEditAction) mobileEditAction.querySelector('span').textContent = text ? 'Edit text' : (state.mediaFile ? 'Replace' : 'Add media');
  if (mobileStyleAction) mobileStyleAction.querySelector('span').textContent = text ? 'Style' : 'Reset size';
}

function updateMediaVisibility() {
  const show = state.mode === 'media';
  mediaImage.classList.toggle('is-hidden', !(show && state.mediaType === 'image'));
  mediaVideo.classList.toggle('is-hidden', !(show && state.mediaType === 'video'));
}

function enterTextEdit(restoreSelection = false) {
  if (state.mode !== 'text') return;
  state.editing = true;
  object.classList.add('is-editing', 'is-selected');
  editableText.contentEditable = 'true';
  editableText.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  if (restoreSelection && savedTextRange) {
    try { sel.addRange(savedTextRange.cloneRange()); return; } catch (_) {}
  }
  const range = document.createRange();
  range.selectNodeContents(editableText);
  range.collapse(false);
  sel.addRange(range);
}

function exitTextEdit() {
  state.editing = false;
  object.classList.remove('is-editing');
  editableText.contentEditable = 'false';
  window.getSelection()?.removeAllRanges();
}

function applyFontToSelection(fontKey) {
  if (state.mode !== 'text') return;
  const family = FONT_NAMES[fontKey] || FONT_NAMES.EzerSemiBold;

  // On touch devices, keep the OS text selection intact while the Style sheet is open.
  // Mutating the saved Range directly avoids bouncing the keyboard back up just to change a font.
  if (mobileQuery.matches && savedTextRange && !savedTextRange.collapsed) {
    try {
      const range = savedTextRange.cloneRange();
      const fragment = range.extractContents();
      const span = document.createElement('span');
      span.style.fontFamily = family;
      span.appendChild(fragment);
      span.querySelectorAll('[style]').forEach((el) => { if (el.style.fontFamily) el.style.removeProperty('font-family'); });
      range.insertNode(span);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      savedTextRange = nextRange;
      return;
    } catch (_) {}
  }

  if (!state.editing) enterTextEdit(true);
  editableText.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (sel && savedTextRange) {
    try { sel.removeAllRanges(); sel.addRange(savedTextRange.cloneRange()); } catch (_) {}
  }
  try {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontName', false, family);
    const current = window.getSelection();
    if (current?.rangeCount && editableText.contains(current.anchorNode)) savedTextRange = current.getRangeAt(0).cloneRange();
  } catch (_) {}
}

function updateActiveFontFromSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode || !editableText.contains(sel.anchorNode)) return;
  if (sel.rangeCount) savedTextRange = sel.getRangeAt(0).cloneRange();
  const el = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
  if (!el) return;
  const family = getComputedStyle(el).fontFamily.replace(/["']/g, '');
  const key = Object.keys(FONT_NAMES).find((k) => family.includes(FONT_NAMES[k]));
  if (key) $('fontSelect').value = key;
}

$('fontSelect').addEventListener('change', (e) => applyFontToSelection(e.target.value));
document.addEventListener('selectionchange', updateActiveFontFromSelection);

$('fontSize').addEventListener('input', (e) => {
  state.fontSize = clamp(e.target.value, 16, 300);
  applyVisualState();
});
$('tracking').addEventListener('input', (e) => {
  state.tracking = clamp(e.target.value, -10, 80);
  applyVisualState();
});
$('lineHeight').addEventListener('input', (e) => {
  state.lineHeight = clamp(e.target.value, 70, 200);
  applyVisualState();
});

function setColor(value) {
  const raw = String(value || '').trim().toUpperCase();
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return false;
  state.color = normalized;
  $('colorPicker').value = normalized.toLowerCase();
  $('colorHex').value = normalized;
  applyVisualState();
  return true;
}
$('colorPicker').addEventListener('input', (e) => setColor(e.target.value));
$('colorHex').addEventListener('input', (e) => {
  if (/^#?[0-9a-fA-F]{6}$/.test(e.target.value)) setColor(e.target.value);
});
$('colorHex').addEventListener('blur', () => { if (!setColor($('colorHex').value)) $('colorHex').value = state.color; });

for (const button of document.querySelectorAll('.align-button')) {
  button.addEventListener('click', () => {
    state.align = button.dataset.align;
    document.querySelectorAll('.align-button').forEach((b) => b.classList.toggle('is-active', b === button));
    applyVisualState();
  });
}

$('xField').addEventListener('input', (e) => { state.x = clamp(e.target.value, -50, 150); applyVisualState(); });
$('yField').addEventListener('input', (e) => { state.y = clamp(e.target.value, -50, 150); applyVisualState(); });
$('widthField').addEventListener('input', (e) => { state.width = clamp(e.target.value, 100, 1080); applyVisualState(); });
$('scaleField').addEventListener('input', (e) => { state.scale = clamp(e.target.value, 10, 300); applyVisualState(); });
$('centerObject').addEventListener('click', () => { state.x = 50; state.y = 50; applyVisualState(); });
$('editTextButton').addEventListener('click', () => { closeMobileInspector(); setTimeout(() => enterTextEdit(true), mobileQuery.matches ? 230 : 0); });
$('textMode').addEventListener('click', () => setMode('text'));
$('mediaMode').addEventListener('click', () => setMode('media'));
mobileTextMode?.addEventListener('click', () => { setMode('text'); closeMobileInspector(); object.classList.add('is-selected'); });
mobileMediaMode?.addEventListener('click', () => { setMode('media'); object.classList.add('is-selected'); if (!state.mediaFile) openMobileInspector(); });
mobileStyleAction?.addEventListener('click', () => {
  object.classList.add('is-selected');
  if (state.mode === 'text') openMobileInspector();
  else { state.width = 1000; state.scale = 100; applyVisualState(); showToast('Media size reset.'); }
});
mobileCenterAction?.addEventListener('click', () => { state.x = 50; state.y = 50; object.classList.add('is-selected'); applyVisualState(); });
mobileEditAction?.addEventListener('click', () => {
  object.classList.add('is-selected');
  if (state.mode === 'text') { closeMobileInspector(); setTimeout(() => enterTextEdit(true), 40); }
  else { openMobileInspector(); setTimeout(() => mediaInput?.click(), 80); }
});
$('mobileWidthRange')?.addEventListener('input', (e) => {
  state.width = clamp(e.target.value, 220, 1080);
  const out = $('mobileWidthValue'); if (out) out.textContent = `${Math.round(state.width)} px`;
  applyVisualState();
});

editableText.addEventListener('input', () => {
  if (!editableText.innerText.trim()) editableText.innerHTML = '<span style="font-family:EzerSemiBold"><br></span>';
});
editableText.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); exitTextEdit(); stage.focus(); }
});
editableText.addEventListener('blur', () => {
  setTimeout(() => {
    const active = document.activeElement;
    if (active !== $('fontSelect') && !editableText.contains(active)) exitTextEdit();
  }, 0);
});

// Direct canvas manipulation. Desktop uses handles; touch adds native drag + pinch-to-scale.
let gesture = null;
const touchPointers = new Map();
let touchGesture = null;

function touchPoint(e) { return { x: e.clientX, y: e.clientY }; }
function touchMidpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function touchDistance(a, b) { return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); }

object.addEventListener('pointerdown', (e) => {
  object.classList.add('is-selected');
  if (state.editing || e.target.closest('.resize-handle')) return;
  if (e.pointerType === 'touch') {
    e.preventDefault();
    touchPointers.set(e.pointerId, touchPoint(e));
    try { object.setPointerCapture(e.pointerId); } catch (_) {}
    if (touchPointers.size === 1) {
      touchGesture = { type: 'move', start: touchPoint(e), x: state.x, y: state.y };
    } else if (touchPointers.size === 2) {
      const [a, b] = [...touchPointers.values()];
      touchGesture = {
        type: 'pinch',
        distance: touchDistance(a, b),
        midpoint: touchMidpoint(a, b),
        scale: state.scale,
        x: state.x,
        y: state.y,
      };
    }
    return;
  }
  if (e.button !== 0) return;
  e.preventDefault();
  gesture = { type: 'move', startX: e.clientX, startY: e.clientY, x: state.x, y: state.y };
  window.addEventListener('pointermove', onGestureMove);
  window.addEventListener('pointerup', endGesture, { once: true });
  window.addEventListener('pointercancel', endGesture, { once: true });
});

object.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch' || !touchPointers.has(e.pointerId) || !touchGesture) return;
  e.preventDefault();
  touchPointers.set(e.pointerId, touchPoint(e));
  const rect = stage.getBoundingClientRect();
  if (touchPointers.size >= 2) {
    const [a, b] = [...touchPointers.values()];
    if (touchGesture.type !== 'pinch') {
      touchGesture = {
        type: 'pinch', distance: touchDistance(a,b), midpoint: touchMidpoint(a,b),
        scale: state.scale, x: state.x, y: state.y,
      };
    }
    const mid = touchMidpoint(a, b);
    state.scale = clamp(touchGesture.scale * touchDistance(a, b) / touchGesture.distance, 10, 300);
    state.x = clamp(touchGesture.x + ((mid.x - touchGesture.midpoint.x) / rect.width) * 100, -50, 150);
    state.y = clamp(touchGesture.y + ((mid.y - touchGesture.midpoint.y) / rect.height) * 100, -50, 150);
  } else if (touchGesture.type === 'move') {
    const pt = [...touchPointers.values()][0];
    state.x = clamp(touchGesture.x + ((pt.x - touchGesture.start.x) / rect.width) * 100, -50, 150);
    state.y = clamp(touchGesture.y + ((pt.y - touchGesture.start.y) / rect.height) * 100, -50, 150);
  }
  applyVisualState();
});

function finishTouchPointer(e) {
  if (e.pointerType !== 'touch') return;
  touchPointers.delete(e.pointerId);
  if (touchPointers.size === 1) {
    const pt = [...touchPointers.values()][0];
    touchGesture = { type: 'move', start: pt, x: state.x, y: state.y };
  } else if (!touchPointers.size) touchGesture = null;
}
object.addEventListener('pointerup', finishTouchPointer);
object.addEventListener('pointercancel', finishTouchPointer);

object.addEventListener('dblclick', (e) => {
  if (state.mode === 'text' && !e.target.closest('.resize-handle')) { e.preventDefault(); enterTextEdit(); }
});
for (const handle of document.querySelectorAll('.resize-handle')) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    e.preventDefault(); e.stopPropagation();
    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + rect.width * state.x / 100;
    const centerY = rect.top + rect.height * state.y / 100;
    const type = handle.dataset.handle;
    gesture = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      width: state.width,
      scale: state.scale,
      centerX,
      centerY,
      distance: Math.max(1, Math.hypot(e.clientX - centerX, e.clientY - centerY)),
    };
    window.addEventListener('pointermove', onGestureMove);
    window.addEventListener('pointerup', endGesture, { once: true });
    window.addEventListener('pointercancel', endGesture, { once: true });
  });
}
function onGestureMove(e) {
  if (!gesture) return;
  if (e.cancelable) e.preventDefault();
  const rect = stage.getBoundingClientRect();
  if (gesture.type === 'move') {
    state.x = clamp(gesture.x + ((e.clientX - gesture.startX) / rect.width) * 100, -50, 150);
    state.y = clamp(gesture.y + ((e.clientY - gesture.startY) / rect.height) * 100, -50, 150);
  } else if (gesture.type.startsWith('width')) {
    const dxCanvas = ((e.clientX - gesture.startX) / rect.width) * 1080;
    const direction = gesture.type === 'width-right' ? 1 : -1;
    state.width = clamp(gesture.width + direction * dxCanvas * 2 / Math.max(.1, state.scale / 100), 100, 1080);
  } else if (gesture.type === 'scale') {
    const d = Math.max(1, Math.hypot(e.clientX - gesture.centerX, e.clientY - gesture.centerY));
    state.scale = clamp(gesture.scale * (d / gesture.distance), 10, 300);
  }
  applyVisualState();
}
function endGesture() {
  window.removeEventListener('pointermove', onGestureMove);
  window.removeEventListener('pointercancel', endGesture);
  gesture = null;
}

stage.addEventListener('pointerdown', (e) => {
  if (e.target === stage || e.target.closest('.missing-assets')) {
    exitTextEdit();
    object.classList.remove('is-selected');
  }
});

stage.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !state.editing) object.classList.remove('is-selected');
});

// Media upload / drop.
const mediaInput = $('mediaInput');
const uploadDrop = $('uploadDrop');
mediaInput.addEventListener('change', () => mediaInput.files?.[0] && loadMedia(mediaInput.files[0]));
['dragenter','dragover'].forEach((name) => uploadDrop.addEventListener(name, (e) => { e.preventDefault(); uploadDrop.classList.add('is-over'); }));
['dragleave','drop'].forEach((name) => uploadDrop.addEventListener(name, (e) => { e.preventDefault(); uploadDrop.classList.remove('is-over'); }));
uploadDrop.addEventListener('drop', (e) => { const file = e.dataTransfer.files?.[0]; if (file) loadMedia(file); });
$('removeMedia').addEventListener('click', clearMedia);

function clearMedia() {
  if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
  state.mediaFile = null; state.mediaType = null; state.mediaUrl = null; state.mediaRatio = 1;
  mediaImage.removeAttribute('src'); mediaVideo.removeAttribute('src');
  $('uploadLabel').textContent = 'Choose image or video';
  $('removeMedia').classList.add('is-hidden');
  updateMediaVisibility();
}
function loadMedia(file) {
  clearMedia();
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/') || /\.(mov|mkv|webm|mp4|m4v|avi)$/i.test(file.name);
  if (!isImage && !isVideo) { showToast('That file type is not supported.'); return; }
  state.mediaFile = file;
  state.mediaType = isImage ? 'image' : 'video';
  state.mediaUrl = URL.createObjectURL(file);
  $('uploadLabel').textContent = file.name;
  $('removeMedia').classList.remove('is-hidden');
  if (isImage) {
    mediaImage.src = state.mediaUrl;
    mediaImage.onload = () => { state.mediaRatio = mediaImage.naturalWidth / mediaImage.naturalHeight || 1; updateMediaVisibility(); };
  } else {
    mediaVideo.src = state.mediaUrl;
    mediaVideo.onloadedmetadata = () => { state.mediaRatio = mediaVideo.videoWidth / mediaVideo.videoHeight || 1; updateMediaVisibility(); };
  }
  setMode('media');
}

// Template preview.
async function initTemplate() {
  bgVideo.src = './assets/bg.webm';
  fgVideo.src = './assets/fg.webm';
  try {
    await Promise.all([waitForMetadata(bgVideo), waitForMetadata(fgVideo)]);
    state.duration = bgVideo.duration;
    state.templateReady = Number.isFinite(state.duration) && state.duration > 0;
    if (!state.templateReady) throw new Error('Invalid duration');
    $('missingAssets').classList.add('is-hidden');
    $('timeline').max = state.duration;
    $('timeline').disabled = false;
    $('playPause').disabled = false;
    $('exportButton').disabled = false;
    $('timeTotal').textContent = formatTime(state.duration);
    fgVideo.muted = true;
    syncAt(0);
  } catch (_) {
    state.templateReady = false;
  }
}
function waitForMetadata(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && Number.isFinite(video.duration)) return resolve();
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('video load failed')); };
    const cleanup = () => { video.removeEventListener('loadedmetadata', ok); video.removeEventListener('error', fail); };
    video.addEventListener('loadedmetadata', ok, { once: true });
    video.addEventListener('error', fail, { once: true });
  });
}

function setVideoTime(video, t) {
  if (!video.src || !Number.isFinite(video.duration)) return;
  video.currentTime = Math.min(Math.max(0, t), Math.max(0, video.duration - .001));
}
function syncAt(t) {
  setVideoTime(bgVideo, t);
  setVideoTime(fgVideo, t);
  if (state.mediaType === 'video') setVideoTime(mediaVideo, t % Math.max(.001, mediaVideo.duration || state.duration));
  $('timeline').value = t;
  $('timeNow').textContent = formatTime(t);
  applyVisualState(t);
}

$('timeline').addEventListener('input', (e) => {
  pausePreview();
  syncAt(Number(e.target.value));
});
$('playPause').addEventListener('click', () => bgVideo.paused ? playPreview() : pausePreview());

async function playPreview() {
  if (!state.templateReady) return;
  closeMobileInspector();
  object.classList.remove('is-selected');
  if (bgVideo.currentTime >= state.duration - .02) syncAt(0);
  setVideoTime(fgVideo, bgVideo.currentTime);
  if (state.mediaType === 'video') setVideoTime(mediaVideo, bgVideo.currentTime % Math.max(.001, mediaVideo.duration || state.duration));
  try {
    await bgVideo.play();
    fgVideo.play().catch(() => {});
    if (state.mode === 'media' && state.mediaType === 'video') mediaVideo.play().catch(() => {});
    $('playGlyph').innerHTML = '<path d="M6.5 5h2.5v10H6.5zM11 5h2.5v10H11z"/>';
    tickPreview();
  } catch (_) { showToast('Playback was blocked by the browser.'); }
}
function pausePreview() {
  bgVideo.pause(); fgVideo.pause(); mediaVideo.pause();
  cancelAnimationFrame(state.raf);
  $('playGlyph').innerHTML = '<path d="m7 5 8 5-8 5z"/>';
}
function tickPreview() {
  if (bgVideo.paused) return;
  const t = bgVideo.currentTime;
  $('timeline').value = Math.min(t, state.duration);
  $('timeNow').textContent = formatTime(t);
  if (Math.abs(fgVideo.currentTime - t) > .08) setVideoTime(fgVideo, t);
  if (state.mode === 'media' && state.mediaType === 'video' && mediaVideo.duration) {
    const mt = t % mediaVideo.duration;
    if (Math.abs(mediaVideo.currentTime - mt) > .1) setVideoTime(mediaVideo, mt);
  }
  applyVisualState(t);
  if (t >= state.duration - .015) { pausePreview(); syncAt(0); return; }
  state.raf = requestAnimationFrame(tickPreview);
}

// Rich text extraction for canvas rendering.
function fontKeyForElement(el) {
  const family = getComputedStyle(el).fontFamily.replace(/["']/g, '');
  return Object.keys(FONT_NAMES).find((k) => family.includes(FONT_NAMES[k])) || 'EzerSemiBold';
}
function extractStyledChars() {
  const chars = [];
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const key = fontKeyForElement(node.parentElement || editableText);
      for (const ch of node.nodeValue || '') chars.push({ ch, font: key });
      return;
    }
    if (node.nodeName === 'BR') { chars.push({ ch: '\n', font: 'EzerSemiBold' }); return; }
    const isBlock = node !== editableText && /^(DIV|P)$/.test(node.nodeName);
    if (isBlock && chars.length && chars[chars.length - 1].ch !== '\n') chars.push({ ch: '\n', font: 'EzerSemiBold' });
    for (const child of node.childNodes) walk(child);
  };
  walk(editableText);
  while (chars.length && chars[chars.length - 1].ch === '\n') chars.pop();
  return chars.length ? chars : [{ ch: ' ', font: 'EzerSemiBold' }];
}

function fontString(key, px) { return `${px}px "${FONT_NAMES[key] || FONT_NAMES.EzerSemiBold}"`; }
function charWidth(ctx, item, fontSize) {
  ctx.font = fontString(item.font, fontSize);
  return ctx.measureText(item.ch).width + state.tracking;
}
function layoutText(ctx, chars) {
  const maxWidth = state.width;
  const lines = [];
  let line = [], width = 0;
  const commit = () => { lines.push({ chars: line, width: Math.max(0, width - (line.length ? state.tracking : 0)) }); line = []; width = 0; };
  for (const item of chars) {
    if (item.ch === '\n') { commit(); continue; }
    const cw = charWidth(ctx, item, state.fontSize);
    if (line.length && width + cw > maxWidth) {
      let split = -1;
      for (let i = line.length - 1; i >= 0; i--) { if (/\s/.test(line[i].ch)) { split = i; break; } }
      if (split > 0) {
        const carry = line.splice(split + 1);
        line.pop();
        width = line.reduce((sum, c) => sum + charWidth(ctx, c, state.fontSize), 0);
        commit();
        line = carry;
        width = line.reduce((sum, c) => sum + charWidth(ctx, c, state.fontSize), 0);
      } else commit();
    }
    line.push(item); width += cw;
  }
  commit();
  return lines;
}
function drawTextLayer(ctx, time) {
  const chars = extractStyledChars();
  const lines = layoutText(ctx, chars);
  const linePx = state.fontSize * state.lineHeight / 100;
  const totalHeight = linePx * lines.length;
  const s = animatedScaleAt(time);
  ctx.save();
  ctx.translate(1080 * state.x / 100, 1920 * state.y / 100);
  ctx.scale(s, s);
  ctx.fillStyle = state.color;
  ctx.textBaseline = 'alphabetic';
  let y = -totalHeight / 2 + state.fontSize;
  for (const line of lines) {
    let x;
    if (state.align === 'left') x = -state.width / 2;
    else if (state.align === 'right') x = state.width / 2 - line.width;
    else x = -line.width / 2;
    for (const item of line.chars) {
      ctx.font = fontString(item.font, state.fontSize);
      ctx.fillText(item.ch, x, y);
      x += ctx.measureText(item.ch).width + state.tracking;
    }
    y += linePx;
  }
  ctx.restore();
}
function drawMediaLayer(ctx, source, time) {
  if (!source) return;
  const ratio = state.mediaRatio || (source.width && source.height ? source.width / source.height : 1);
  const w = state.width;
  const h = w / Math.max(.01, ratio);
  const s = animatedScaleAt(time);
  ctx.save();
  ctx.translate(1080 * state.x / 100, 1920 * state.y / 100);
  ctx.scale(s, s);
  ctx.drawImage(source, -w / 2, -h / 2, w, h);
  ctx.restore();
}

async function imageBitmapFromFile(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
  URL.revokeObjectURL(url);
  return img;
}

$('exportButton').addEventListener('click', exportVideo);
async function exportVideo() {
  closeMobileInspector();
  if (!state.templateReady) return showToast('Add bg.webm and fg.webm first.');
  if (!('VideoEncoder' in window)) return showToast('This browser cannot encode MP4. Update the browser or try Chrome, Edge, or Safari.');
  pausePreview();
  exitTextEdit();
  object.classList.remove('is-selected');
  $('exportOverlay').classList.remove('is-hidden');
  $('progressFill').style.width = '0%';
  $('progressPercent').textContent = '0%';
  $('exportTitle').textContent = 'Rendering video';
  $('exportSaveButton').classList.add('is-hidden');
  if (pendingExport?.url) URL.revokeObjectURL(pendingExport.url);
  pendingExport = null;
  $('exportDetail').textContent = 'Loading renderer…';

  try {
    await document.fonts.ready;
    const mb = await import('https://cdn.jsdelivr.net/npm/mediabunny@1.55.4/+esm');
    const {
      Input, ALL_FORMATS, BlobSource, CanvasSink, AudioBufferSink,
      Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality,
    } = mb;

    $('exportDetail').textContent = 'Reading template…';
    const [bgResponse, fgResponse] = await Promise.all([fetch('./assets/bg.webm'), fetch('./assets/fg.webm')]);
    if (!bgResponse.ok || !fgResponse.ok) throw new Error('Template videos could not be loaded.');
    const [bgBlob, fgBlob] = await Promise.all([bgResponse.blob(), fgResponse.blob()]);

    const bgInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(bgBlob) });
    const fgInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(fgBlob) });
    const bgTrack = await bgInput.getPrimaryVideoTrack();
    const fgTrack = await fgInput.getPrimaryVideoTrack();
    if (!bgTrack || !fgTrack) throw new Error('Both template files need a video track.');

    const duration = await bgInput.computeDuration();
    const fps = 30;
    const frameDuration = 1 / fps;
    const frameCount = Math.max(1, Math.round(duration * fps));

    // Sequential decode with two-frame lookahead. We interpolate between the
    // surrounding source frames instead of asking for "the last frame <= t".
    // That avoids accidental repeats from WebM's millisecond timestamp grid and
    // also produces smooth CFR output when the source cadence is slightly uneven.
    const bgSink = new CanvasSink(bgTrack, { width: 1080, height: 1920, fit: 'fill' });
    const fgSink = new CanvasSink(fgTrack, { width: 1080, height: 1920, fit: 'fill', alpha: true });

    function makeSequentialSampler(sink, endTime) {
      const iterator = sink.canvases(0, endTime)[Symbol.asyncIterator]();
      let a = null, b = null, initialized = false, ended = false;
      async function pull() {
        const r = await iterator.next();
        if (r.done || !r.value) { ended = true; return null; }
        return r.value;
      }
      return {
        async sample(t) {
          if (!initialized) {
            a = await pull();
            b = await pull();
            initialized = true;
          }
          if (!a) return null;
          while (b && t >= b.timestamp) {
            a = b;
            b = await pull();
          }
          if (!b || ended || b.timestamp <= a.timestamp) return { a: a.canvas, b: null, mix: 0 };
          const mix = Math.max(0, Math.min(1, (t - a.timestamp) / (b.timestamp - a.timestamp)));
          return { a: a.canvas, b: b.canvas, mix };
        }
      };
    }

    const bgSampler = makeSequentialSampler(bgSink, duration + frameDuration);
    const fgSampler = makeSequentialSampler(fgSink, duration + frameDuration);

    // If the templates are native ~30 fps, map source frames 1:1 to output frames.
    // This is the most deterministic path and cannot repeat a source frame because
    // of timestamp rounding. Other source rates fall back to sequential resampling.
    let nativeThirty = false;
    try {
      const [bgFps, fgFps] = await Promise.all([bgTrack.computeFrameRateMetrics(), fgTrack.computeFrameRateMetrics()]);
      nativeThirty = Math.abs(bgFps.bestGuessFrameRate - fps) < 0.35 && Math.abs(fgFps.bestGuessFrameRate - fps) < 0.35;
      console.info('Template FPS', { background: bgFps.bestGuessFrameRate, foreground: fgFps.bestGuessFrameRate, nativeThirty });
    } catch (_) {}
    const bgNativeIterator = nativeThirty ? bgSink.canvases(0, duration + frameDuration)[Symbol.asyncIterator]() : null;
    const fgNativeIterator = nativeThirty ? fgSink.canvases(0, duration + frameDuration)[Symbol.asyncIterator]() : null;

    let mediaInputExport = null, mediaIterator = null, mediaBitmap = null;
    if (state.mode === 'media' && state.mediaFile) {
      if (state.mediaType === 'image') {
        mediaBitmap = await imageBitmapFromFile(state.mediaFile);
        state.mediaRatio = (mediaBitmap.width || 1) / (mediaBitmap.height || 1);
      } else {
        mediaInputExport = new Input({ formats: ALL_FORMATS, source: new BlobSource(state.mediaFile) });
        const mediaTrack = await mediaInputExport.getPrimaryVideoTrack();
        if (!mediaTrack) throw new Error('The uploaded file does not contain a readable video track.');
        const mw = await mediaTrack.getDisplayWidth();
        const mh = await mediaTrack.getDisplayHeight();
        if (mw && mh) state.mediaRatio = mw / mh;
        const mediaDuration = await mediaTrack.computeDuration();
        const mediaSink = new CanvasSink(mediaTrack);
        const mediaTimes = Array.from({ length: frameCount }, (_, i) => (i * frameDuration) % Math.max(frameDuration, mediaDuration));
        // Looping timestamps are not monotonic; getCanvas is safer for the occasional uploaded clip.
        mediaIterator = { next: async (i) => ({ value: await mediaSink.getCanvas(mediaTimes[i]), done: false }) };
      }
    }

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = 1080; renderCanvas.height = 1920;
    const ctx = renderCanvas.getContext('2d', { alpha: false, desynchronized: true });

    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const videoSource = new CanvasSource(renderCanvas, {
      codec: 'avc',
      quality: new Quality({ bitrate: 20_000_000 }),
      keyFrameInterval: 2,
    });
    // Declare the intended CFR explicitly so timestamps/durations are snapped to 30 fps.
    output.addVideoTrack(videoSource, { frameRate: fps });

    let audioSource = null, audioSink = null;
    const audioTrack = await bgInput.getPrimaryAudioTrack();
    if (audioTrack && 'AudioEncoder' in window) {
      audioSource = new AudioBufferSource({ codec: 'aac', quality: new Quality({ bitrate: 256_000 }) });
      output.addAudioTrack(audioSource);
      audioSink = new AudioBufferSink(audioTrack);
    }

    await output.start();
    $('exportDetail').textContent = 'Rendering frames…';

    const audioPromise = (async () => {
      if (!audioSource || !audioSink) return;
      for await (const wrapped of audioSink.buffers(0, duration)) await audioSource.add(wrapped.buffer);
      audioSource.close();
    })();

    for (let i = 0; i < frameCount; i++) {
      const t = i * frameDuration;
      let bgFrame, fgFrame;
      if (nativeThirty) {
        const [bgNative, fgNative] = await Promise.all([bgNativeIterator.next(), fgNativeIterator.next()]);
        if (bgNative.done || fgNative.done || !bgNative.value?.canvas || !fgNative.value?.canvas) {
          throw new Error(`Template ended before output frame ${i + 1}. Re-export bg.webm and fg.webm at constant 30 fps.`);
        }
        bgFrame = { a: bgNative.value.canvas, b: null, mix: 0 };
        fgFrame = { a: fgNative.value.canvas, b: null, mix: 0 };
      } else {
        [bgFrame, fgFrame] = await Promise.all([bgSampler.sample(t), fgSampler.sample(t)]);
      }
      if (!bgFrame?.a || !fgFrame?.a) throw new Error(`Could not decode frame ${i + 1}.`);

      ctx.clearRect(0, 0, 1080, 1920);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
      ctx.globalAlpha = 1;
      ctx.drawImage(bgFrame.a, 0, 0, 1080, 1920);
      if (bgFrame.b && bgFrame.mix > .0001) {
        ctx.globalAlpha = bgFrame.mix;
        ctx.drawImage(bgFrame.b, 0, 0, 1080, 1920);
        ctx.globalAlpha = 1;
      }

      if (state.mode === 'text') drawTextLayer(ctx, t);
      else if (state.mediaType === 'image' && mediaBitmap) drawMediaLayer(ctx, mediaBitmap, t);
      else if (state.mediaType === 'video' && mediaIterator) {
        const mediaResult = await mediaIterator.next(i);
        if (mediaResult.value?.canvas) drawMediaLayer(ctx, mediaResult.value.canvas, t);
      }

      ctx.globalAlpha = 1;
      ctx.drawImage(fgFrame.a, 0, 0, 1080, 1920);
      if (fgFrame.b && fgFrame.mix > .0001) {
        ctx.globalAlpha = fgFrame.mix;
        ctx.drawImage(fgFrame.b, 0, 0, 1080, 1920);
        ctx.globalAlpha = 1;
      }
      await videoSource.add(t, frameDuration, i % (fps * 2) === 0 ? { keyFrame: true } : undefined);

      const pct = Math.round(((i + 1) / frameCount) * 96);
      $('progressFill').style.width = `${pct}%`;
      $('progressPercent').textContent = `${pct}%`;
      if (i % 8 === 0) await new Promise(requestAnimationFrame);
    }
    videoSource.close();
    await audioPromise;
    $('exportDetail').textContent = 'Finalizing MP4…';
    $('progressFill').style.width = '98%'; $('progressPercent').textContent = '98%';
    await output.finalize();

    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    const file = new File([blob], 'toolbox-video.mp4', { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    if (mediaBitmap?.close) mediaBitmap.close();

    $('progressFill').style.width = '100%'; $('progressPercent').textContent = '100%';
    $('exportDetail').textContent = 'Done';

    const touchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (touchDevice) {
      pendingExport = { url, file };
      $('exportSaveButton').classList.remove('is-hidden');
      $('exportTitle').textContent = 'Video ready';
      $('exportDetail').textContent = 'Save or share the MP4';
    } else {
      const a = document.createElement('a');
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setTimeout(() => $('exportOverlay').classList.add('is-hidden'), 650);
      showToast('MP4 exported.');
    }
  } catch (error) {
    console.error(error);
    $('exportOverlay').classList.add('is-hidden');
    showToast(error?.message || 'Export failed.');
  }
}

new ResizeObserver(updateStageUnit).observe(stage);
window.addEventListener('resize', updateStageUnit);
window.addEventListener('orientationchange', () => setTimeout(updateStageUnit, 120));
setMode('text');
setColor('#F3F3F3');
applyVisualState(0);
initTemplate();
