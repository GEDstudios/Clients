
const brandMark = document.getElementById("brandMark");
const brandLogo = document.getElementById("brandLogo");
if (brandLogo && brandMark) {
  brandLogo.addEventListener("load", () => brandMark.classList.add("has-logo"));
  brandLogo.addEventListener("error", () => brandMark.classList.remove("has-logo"));
  if (brandLogo.complete && brandLogo.naturalWidth > 0) brandMark.classList.add("has-logo");
}
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
  closingLogo: true,
  closingLogoAvailable: false,
  raf: null,
};

const stage = $('stage');
const object = $('object');
const objectContent = $('objectContent');
const editableText = $('editableText');
const bgVideo = $('bgVideo');
const fgVideo = $('fgVideo');
const fg2Video = $('fg2Video');
const closingLogoToggle = $('closingLogoToggle');
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
const mobileSelectionToolbar = $('mobileSelectionToolbar');
const mobileFontMenuButton = $('mobileFontMenuButton');
const mobileFontPopover = $('mobileFontPopover');
const mobileFontLabel = $('mobileFontLabel');
const mobileFontSizeDown = $('mobileFontSizeDown');
const mobileFontSizeUp = $('mobileFontSizeUp');
const mobileFontSizeValue = $('mobileFontSizeValue');
const mobileSelectionColor = $('mobileSelectionColor');
const mobileColorSwatch = $('mobileColorSwatch');
const mobileSelectionMore = $('mobileSelectionMore');
const mobileQuery = window.matchMedia('(max-width: 760px)');
let savedTextRange = null;
let pendingExport = null;
let previewMasterVideo = bgVideo;

const MOBILE_FONT_LABELS = {
  EzerLight: 'Ezer Light',
  EzerBook: 'Ezer Book',
  EzerRegular: 'Ezer Regular',
  EzerSemiBold: 'Ezer SemiBold',
  Gestura: 'Gestura Black Italic',
};

function savedSelectionIsUsable() {
  if (!savedTextRange || savedTextRange.collapsed) return false;
  const root = savedTextRange.commonAncestorContainer?.nodeType === Node.TEXT_NODE
    ? savedTextRange.commonAncestorContainer.parentElement
    : savedTextRange.commonAncestorContainer;
  return !!root && editableText.contains(root);
}

function setMobileFontUi(fontKey) {
  const key = MOBILE_FONT_LABELS[fontKey] ? fontKey : 'EzerSemiBold';
  if (mobileFontLabel) mobileFontLabel.textContent = MOBILE_FONT_LABELS[key];
  document.querySelectorAll('[data-mobile-font]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mobileFont === key);
  });
}

function syncMobileSelectionControls() {
  if (mobileFontSizeValue) mobileFontSizeValue.textContent = Math.round(state.fontSize);
  if (mobileSelectionColor) mobileSelectionColor.value = state.color.toLowerCase();
  if (mobileColorSwatch) mobileColorSwatch.style.background = state.color;
}

function hideMobileSelectionToolbar() {
  mobileSelectionToolbar?.classList.remove('is-visible');
  mobileSelectionToolbar?.setAttribute('aria-hidden', 'true');
  if (mobileFontPopover) mobileFontPopover.hidden = true;
  mobileFontMenuButton?.setAttribute('aria-expanded', 'false');
}

function positionMobileSelectionToolbar() {
  if (!mobileSelectionToolbar?.classList.contains('is-visible')) return;

  const vv = window.visualViewport;
  const viewportTop = vv ? vv.offsetTop : 0;
  const viewportHeight = vv ? vv.height : window.innerHeight;
  const viewportBottom = viewportTop + viewportHeight;
  const toolbarHeight = mobileSelectionToolbar.offsetHeight || 56;
  const edgeGap = 8;

  // Keep the mobile typography bar predictable and easy to discover: it acts
  // like a keyboard accessory and stays immediately above the visible keyboard
  // (or bottom of the visual viewport when no keyboard is present).
  const top = Math.max(
    viewportTop + edgeGap,
    viewportBottom - toolbarHeight - edgeGap
  );

  mobileSelectionToolbar.style.top = `${Math.round(top)}px`;
  mobileSelectionToolbar.classList.remove('is-docked-top');
  mobileSelectionToolbar.classList.add('is-docked-bottom');

  // The font list always opens upward from the low toolbar. Limit it to the
  // actual visible space above the toolbar so it never escapes off-screen.
  const availableAbove = Math.max(112, top - viewportTop - 14);
  mobileSelectionToolbar.style.setProperty(
    '--mobile-font-menu-max-height',
    `${Math.floor(Math.min(260, availableAbove))}px`
  );
}

editableText.addEventListener('pointerup', () => {
  if (mobileQuery.matches && state.editing) setTimeout(refreshMobileSelectionToolbarFromSelection, 0);
});
editableText.addEventListener('keyup', () => {
  if (mobileQuery.matches && state.editing) setTimeout(refreshMobileSelectionToolbarFromSelection, 0);
});

// Keep button taps from stealing focus from the contenteditable, so the keyboard and selection stay put.
for (const control of [mobileFontMenuButton, mobileFontSizeDown, mobileFontSizeUp]) {
  control?.addEventListener('pointerdown', (e) => e.preventDefault());
}
mobileFontMenuButton?.addEventListener('click', () => {
  const nextOpen = mobileFontPopover?.hidden !== false;
  if (mobileFontPopover) mobileFontPopover.hidden = !nextOpen;
  mobileFontMenuButton.setAttribute('aria-expanded', String(nextOpen));
  requestAnimationFrame(positionMobileSelectionToolbar);
});

document.querySelectorAll('[data-mobile-font]').forEach((button) => {
  button.addEventListener('pointerdown', (e) => e.preventDefault());
  button.addEventListener('click', () => {
    const key = button.dataset.mobileFont;
    $('fontSelect').value = key;
    setMobileFontUi(key);
    applyFontToSelection(key);
    if (mobileFontPopover) mobileFontPopover.hidden = true;
    mobileFontMenuButton?.setAttribute('aria-expanded', 'false');
    showMobileSelectionToolbar();
  });
});

function stepMobileFontSize(delta) {
  state.fontSize = clamp(state.fontSize + delta, 16, 300);
  $('fontSize').value = Math.round(state.fontSize);
  syncMobileSelectionControls();
  applyVisualState();
  showMobileSelectionToolbar();
}
mobileFontSizeDown?.addEventListener('click', () => stepMobileFontSize(-2));
mobileFontSizeUp?.addEventListener('click', () => stepMobileFontSize(2));
mobileSelectionColor?.addEventListener('input', (e) => {
  setColor(e.target.value);
  showMobileSelectionToolbar();
});
mobileSelectionMore?.addEventListener('pointerdown', (e) => e.preventDefault());
mobileSelectionMore?.addEventListener('click', () => {
  hideMobileSelectionToolbar();
  // The full panel is useful for tracking, line height, width and alignment.
  editableText.blur();
  setTimeout(openMobileInspector, 80);
});

window.visualViewport?.addEventListener('resize', positionMobileSelectionToolbar);
window.visualViewport?.addEventListener('scroll', positionMobileSelectionToolbar);
window.addEventListener('resize', positionMobileSelectionToolbar);

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
  fg2Video.src = './assets/fg2.webm';
  const fg2Metadata = waitForMetadata(fg2Video).then(() => true, () => false);
  try {
    await Promise.all([waitForMetadata(bgVideo), waitForMetadata(fgVideo)]);

    // fg2.webm is optional. Its absence must never block the main template.
    if (await fg2Metadata) {
      state.closingLogoAvailable = true;
      fg2Video.muted = true;
      closingLogoToggle?.removeAttribute('disabled');
      if (closingLogoToggle) closingLogoToggle.checked = state.closingLogo;
      fg2Video.classList.toggle('is-hidden', !state.closingLogo);
    } else {
      state.closingLogoAvailable = false;
      state.closingLogo = false;
      if (closingLogoToggle) {
        closingLogoToggle.checked = false;
        closingLogoToggle.disabled = false;
      }
      fg2Video.classList.add('is-hidden');
    }

    // The composition always uses the longest available template video.
    const candidates = [
      { video: bgVideo, duration: bgVideo.duration },
      { video: fgVideo, duration: fgVideo.duration },
      ...(state.closingLogoAvailable ? [{ video: fg2Video, duration: fg2Video.duration }] : []),
    ].filter(item => Number.isFinite(item.duration) && item.duration > 0);
    const longest = candidates.reduce((best, item) => !best || item.duration > best.duration ? item : best, null);
    state.duration = longest?.duration || 0;
    previewMasterVideo = longest?.video || bgVideo;
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
  if (state.closingLogoAvailable) setVideoTime(fg2Video, t);
  if (state.mediaType === 'video') setVideoTime(mediaVideo, t % Math.max(.001, mediaVideo.duration || state.duration));
  $('timeline').value = t;
  $('timeNow').textContent = formatTime(t);
  applyVisualState(t);
}

$('timeline').addEventListener('input', (e) => {
  pausePreview();
  syncAt(Number(e.target.value));
});
$('playPause').addEventListener('click', () => previewMasterVideo.paused ? playPreview() : pausePreview());

async function playPreview() {
  if (!state.templateReady) return;
  closeMobileInspector();
  object.classList.remove('is-selected');
  let current = Number($('timeline').value) || 0;
  if (current >= state.duration - .02) { syncAt(0); current = 0; }
  setVideoTime(bgVideo, current);
  setVideoTime(fgVideo, current);
  if (state.closingLogoAvailable) setVideoTime(fg2Video, current);
  if (state.mediaType === 'video') setVideoTime(mediaVideo, current % Math.max(.001, mediaVideo.duration || state.duration));
  try {
    // The longest template video is the preview clock, even when fg2 is hidden.
    await previewMasterVideo.play();
    if (previewMasterVideo !== bgVideo) bgVideo.play().catch(() => {});
    if (previewMasterVideo !== fgVideo) fgVideo.play().catch(() => {});
    if (state.closingLogoAvailable && (state.closingLogo || previewMasterVideo === fg2Video) && previewMasterVideo !== fg2Video) fg2Video.play().catch(() => {});
    if (state.mode === 'media' && state.mediaType === 'video') mediaVideo.play().catch(() => {});
    $('playGlyph').innerHTML = '<path d="M6.5 5h2.5v10H6.5zM11 5h2.5v10H11z"/>';
    tickPreview();
  } catch (_) { showToast('Playback was blocked by the browser.'); }
}
function pausePreview() {
  bgVideo.pause(); fgVideo.pause(); fg2Video.pause(); mediaVideo.pause();
  cancelAnimationFrame(state.raf);
  $('playGlyph').innerHTML = '<path d="m7 5 8 5-8 5z"/>';
}
function tickPreview() {
  if (previewMasterVideo.paused) return;
  const t = previewMasterVideo.currentTime;
  $('timeline').value = Math.min(t, state.duration);
  $('timeNow').textContent = formatTime(t);
  const syncTemplateVideo = (video) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    const target = Math.min(t, Math.max(0, video.duration - .001));
    if (Math.abs(video.currentTime - target) > .08) setVideoTime(video, t);
  };
  syncTemplateVideo(bgVideo);
  syncTemplateVideo(fgVideo);
  if (state.closingLogoAvailable) syncTemplateVideo(fg2Video);
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
    // Load all three template files so duration is independent of the logo toggle.
    const [bgResponse, fgResponse, fg2Response] = await Promise.all([
      fetch('./assets/bg.webm'),
      fetch('./assets/fg.webm'),
      fetch('./assets/fg2.webm').catch(() => null),
    ]);
    if (!bgResponse.ok || !fgResponse.ok) throw new Error('Template videos could not be loaded.');
    if (state.closingLogo && !fg2Response?.ok) throw new Error('Closing logo is enabled, but assets/fg2.webm could not be loaded.');
    const bgBlob = await bgResponse.blob();
    const fgBlob = await fgResponse.blob();
    const fg2Blob = fg2Response?.ok ? await fg2Response.blob() : null;

    const bgInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(bgBlob) });
    const fgInput = new Input({ formats: ALL_FORMATS, source: new BlobSource(fgBlob) });
    const fg2Input = fg2Blob ? new Input({ formats: ALL_FORMATS, source: new BlobSource(fg2Blob) }) : null;
    const bgTrack = await bgInput.getPrimaryVideoTrack();
    const fgTrack = await fgInput.getPrimaryVideoTrack();
    const fg2Track = fg2Input ? await fg2Input.getPrimaryVideoTrack() : null;
    if (!bgTrack || !fgTrack) throw new Error('Both template files need a video track.');
    if (state.closingLogo && !fg2Track) throw new Error('fg2.webm needs a readable video track.');

    const [bgDuration, fgDuration, fg2Duration] = await Promise.all([
      bgInput.computeDuration(),
      fgInput.computeDuration(),
      fg2Input ? fg2Input.computeDuration() : Promise.resolve(0),
    ]);
    const duration = Math.max(bgDuration || 0, fgDuration || 0, fg2Duration || 0);
    const fps = 30;
    const frameDuration = 1 / fps;
    const frameCount = Math.max(1, Math.round(duration * fps));

    // Sequential decode with two-frame lookahead. We interpolate between the
    // surrounding source frames instead of asking for "the last frame <= t".
    // That avoids accidental repeats from WebM's millisecond timestamp grid and
    // also produces smooth CFR output when the source cadence is slightly uneven.
    const bgSink = new CanvasSink(bgTrack, { width: 1080, height: 1920, fit: 'fill' });
    const fgSink = new CanvasSink(fgTrack, { width: 1080, height: 1920, fit: 'fill', alpha: true });
    const fg2Sink = state.closingLogo && fg2Track ? new CanvasSink(fg2Track, { width: 1080, height: 1920, fit: 'fill', alpha: true }) : null;

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

    const bgSampler = makeSequentialSampler(bgSink, bgDuration + frameDuration);
    const fgSampler = makeSequentialSampler(fgSink, fgDuration + frameDuration);
    const fg2Sampler = fg2Sink ? makeSequentialSampler(fg2Sink, fg2Duration + frameDuration) : null;

    // If the templates are native ~30 fps, map source frames 1:1 to output frames.
    // This is the most deterministic path and cannot repeat a source frame because
    // of timestamp rounding. Other source rates fall back to sequential resampling.
    let nativeThirty = false;
    try {
      const metricPromises = [bgTrack.computeFrameRateMetrics(), fgTrack.computeFrameRateMetrics()];
      if (fg2Sink) metricPromises.push(fg2Track.computeFrameRateMetrics());
      const [bgFps, fgFps, fg2Fps] = await Promise.all(metricPromises);
      nativeThirty = Math.abs(bgFps.bestGuessFrameRate - fps) < 0.35 && Math.abs(fgFps.bestGuessFrameRate - fps) < 0.35;
      if (fg2Fps) nativeThirty = nativeThirty && Math.abs(fg2Fps.bestGuessFrameRate - fps) < 0.35;
      console.info('Template FPS', { background: bgFps.bestGuessFrameRate, foreground: fgFps.bestGuessFrameRate, closingLogo: fg2Fps?.bestGuessFrameRate, nativeThirty });
    } catch (_) {}
    const bgNativeIterator = nativeThirty ? bgSink.canvases(0, bgDuration + frameDuration)[Symbol.asyncIterator]() : null;
    const fgNativeIterator = nativeThirty ? fgSink.canvases(0, fgDuration + frameDuration)[Symbol.asyncIterator]() : null;
    const fg2NativeIterator = nativeThirty && fg2Sink ? fg2Sink.canvases(0, fg2Duration + frameDuration)[Symbol.asyncIterator]() : null;

    // Native 30 fps readers hold their final frame once a shorter layer ends.
    // This matches browser video behavior while the composition continues to
    // the longest of bg / fg / fg2.
    function makeHeldNativeReader(iterator) {
      let last = null;
      return {
        async nextFrame() {
          if (iterator) {
            const r = await iterator.next();
            if (!r.done && r.value?.canvas) last = r.value.canvas;
          }
          return last;
        }
      };
    }
    const bgNativeReader = nativeThirty ? makeHeldNativeReader(bgNativeIterator) : null;
    const fgNativeReader = nativeThirty ? makeHeldNativeReader(fgNativeIterator) : null;
    const fg2NativeReader = nativeThirty && fg2NativeIterator ? makeHeldNativeReader(fg2NativeIterator) : null;

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
      for await (const wrapped of audioSink.buffers(0, bgDuration)) await audioSource.add(wrapped.buffer);
      audioSource.close();
    })();

    for (let i = 0; i < frameCount; i++) {
      const t = i * frameDuration;
      let bgFrame, fgFrame, fg2Frame = null;
      if (nativeThirty) {
        const [bgCanvas, fgCanvas, fg2Canvas] = await Promise.all([
          bgNativeReader.nextFrame(),
          fgNativeReader.nextFrame(),
          fg2NativeReader ? fg2NativeReader.nextFrame() : Promise.resolve(null),
        ]);
        if (!bgCanvas || !fgCanvas) throw new Error(`Could not decode template frame ${i + 1}.`);
        bgFrame = { a: bgCanvas, b: null, mix: 0 };
        fgFrame = { a: fgCanvas, b: null, mix: 0 };
        if (fg2Canvas) fg2Frame = { a: fg2Canvas, b: null, mix: 0 };
      } else {
        const sampled = await Promise.all([bgSampler.sample(t), fgSampler.sample(t), fg2Sampler ? fg2Sampler.sample(t) : Promise.resolve(null)]);
        [bgFrame, fgFrame, fg2Frame] = sampled;
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

      // Optional closing-logo overlay is the final visual layer.
      if (state.closingLogo && fg2Frame?.a) {
        ctx.globalAlpha = 1;
        ctx.drawImage(fg2Frame.a, 0, 0, 1080, 1920);
        if (fg2Frame.b && fg2Frame.mix > .0001) {
          ctx.globalAlpha = fg2Frame.mix;
          ctx.drawImage(fg2Frame.b, 0, 0, 1080, 1920);
          ctx.globalAlpha = 1;
        }
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

setMobileFontUi('EzerSemiBold');
syncMobileSelectionControls();
