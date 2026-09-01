
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

const PREVIEW_FPS = 30;
const TEXT_ENTRANCE_DELAY_FRAMES = 10;
const TEXT_ENTRANCE_DURATION_FRAMES = 10;
const WORD_STAGGER_FRAMES = 3;
const TEXT_RISE_PX = 20;
const TEXT_ENTRANCE_START = TEXT_ENTRANCE_DELAY_FRAMES / PREVIEW_FPS;

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
  wordByWord: false,
  previewAudioUnlocked: false,
  lastPreviewTime: 0,
  raf: null,
};

const stage = $('stage');
const object = $('object');
const objectContent = $('objectContent');
const editableText = $('editableText');
const animatedText = $('animatedText');
const textContentEditor = $('textContentEditor');
const wordByWordToggle = $('wordByWordToggle');
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
let savedTextRoot = editableText;
let activeTextEditor = editableText;
let syncingRichEditors = false;
let pendingExport = null;
let previewMasterVideo = bgVideo;

const MOBILE_FONT_LABELS = {
  EzerLight: 'Ezer Light',
  EzerBook: 'Ezer Book',
  EzerRegular: 'Ezer Regular',
  EzerSemiBold: 'Ezer SemiBold',
  Gestura: 'Gestura Black Italic',
};

function textEditorContainingNode(node) {
  if (!node) return null;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (editableText && (el === editableText || editableText.contains(el))) return editableText;
  if (textContentEditor && (el === textContentEditor || textContentEditor.contains(el))) return textContentEditor;
  return null;
}

function savedSelectionIsUsable() {
  if (!savedTextRange || savedTextRange.collapsed || !savedTextRoot) return false;
  const common = savedTextRange.commonAncestorContainer?.nodeType === Node.TEXT_NODE
    ? savedTextRange.commonAncestorContainer.parentElement
    : savedTextRange.commonAncestorContainer;
  return !!common && (common === savedTextRoot || savedTextRoot.contains(common));
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
  const edgeGap = 10;

  // Keep the typography controls in one predictable place on phones: directly
  // above the visible keyboard / bottom edge of the visual viewport.
  const top = Math.max(
    viewportTop + edgeGap,
    viewportBottom - toolbarHeight - edgeGap
  );

  mobileSelectionToolbar.style.top = `${Math.round(top)}px`;
  mobileSelectionToolbar.classList.remove('is-docked-top');
  mobileSelectionToolbar.classList.add('is-docked-bottom');

  // The font menu opens upward from the toolbar. Cap it to the real visible
  // space so it cannot extend beyond the top of the screen.
  const availableAbove = Math.max(96, top - viewportTop - 18);
  mobileSelectionToolbar.style.setProperty(
    '--mobile-font-menu-max-height',
    `${Math.floor(Math.min(240, availableAbove))}px`
  );
}

function showMobileSelectionToolbar() {
  if (!mobileQuery.matches || state.mode !== 'text' || !savedSelectionIsUsable()) {
    hideMobileSelectionToolbar();
    return;
  }
  syncMobileSelectionControls();
  mobileSelectionToolbar.classList.add('is-visible');
  mobileSelectionToolbar.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(positionMobileSelectionToolbar);
}

function refreshMobileSelectionToolbarFromSelection() {
  if (!mobileQuery.matches || state.mode !== 'text') return hideMobileSelectionToolbar();
  const sel = window.getSelection();
  const root = sel?.anchorNode ? textEditorContainingNode(sel.anchorNode) : null;
  if (sel?.rangeCount && root) {
    activeTextEditor = root;
    savedTextRoot = root;
    if (sel.isCollapsed) {
      // Keep the last real selection while a toolbar/select control temporarily steals focus.
      if (document.activeElement === root) savedTextRange = null;
      return hideMobileSelectionToolbar();
    }
    savedTextRange = sel.getRangeAt(0).cloneRange();
    return showMobileSelectionToolbar();
  }
  if (savedSelectionIsUsable()) showMobileSelectionToolbar();
}

function openMobileInspector() {
  hideMobileSelectionToolbar();
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
mobileQuery.addEventListener?.('change', (e) => {
  if (!e.matches) { closeMobileInspector(); hideMobileSelectionToolbar(); }
});

closingLogoToggle?.addEventListener('change', () => {
  if (closingLogoToggle.checked && !state.closingLogoAvailable) {
    closingLogoToggle.checked = false;
    state.closingLogo = false;
    showToast('Add assets/fg2.webm to use the closing logo.');
    return;
  }
  state.closingLogo = closingLogoToggle.checked;
  fg2Video?.classList.toggle('is-hidden', !state.closingLogo);
  if (state.closingLogo) {
    setVideoTime(fg2Video, Number($('timeline').value) || 0);
    if (!bgVideo.paused) fg2Video.play().catch(() => {});
  } else {
    fg2Video?.pause();
  }
});

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

function cubicBezier0101(progress) {
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  const u = Math.cbrt(p); // x(u) = u^3 for cubic-bezier(0,1,0,1)
  return 1 - Math.pow(1 - u, 3);
}

function textEntranceAt(time, wordIndex = 0) {
  const frame = Math.max(0, Number(time) || 0) * PREVIEW_FPS;
  const stagger = state.wordByWord ? Math.max(0, wordIndex) * WORD_STAGGER_FRAMES : 0;
  const startFrame = TEXT_ENTRANCE_DELAY_FRAMES + stagger;
  // Frames before the start keyframe are not rendered at all. No opacity animation.
  if (frame + 1e-6 < startFrame) return { visible: false, offset: TEXT_RISE_PX };
  const progress = (frame - startFrame) / TEXT_ENTRANCE_DURATION_FRAMES;
  const eased = cubicBezier0101(progress);
  return { visible: true, offset: TEXT_RISE_PX * (1 - eased) };
}

function annotateWordIndexes(chars) {
  let wordIndex = -1;
  let inWord = false;
  return chars.map((item) => {
    if (item.ch === '\n' || /\s/.test(item.ch)) {
      inWord = false;
      return { ...item, wordIndex: null };
    }
    if (!inWord) { wordIndex += 1; inWord = true; }
    return { ...item, wordIndex };
  });
}

function appendStyledChars(parent, chars) {
  let run = null;
  let runFont = null;
  const flush = () => {
    if (run && run.textContent) parent.appendChild(run);
    run = null;
    runFont = null;
  };
  for (const item of chars) {
    if (item.ch === '\n') {
      flush();
      parent.appendChild(document.createElement('br'));
      continue;
    }
    const family = FONT_NAMES[item.font] || FONT_NAMES.EzerSemiBold;
    if (!run || runFont !== family) {
      flush();
      run = document.createElement('span');
      run.style.fontFamily = family;
      runFont = family;
    }
    run.textContent += item.ch;
  }
  flush();
}

function ensureTextModelNotEmpty() {
  if (!editableText.textContent && !editableText.querySelector('br')) {
    editableText.innerHTML = '<span style="font-family:EzerSemiBold"><br></span>';
  }
}

function syncSideEditorFromModel(force = false) {
  if (!textContentEditor || syncingRichEditors) return;
  if (!force && activeTextEditor === textContentEditor && document.activeElement === textContentEditor) return;
  syncingRichEditors = true;
  try { textContentEditor.innerHTML = editableText.innerHTML; }
  finally { syncingRichEditors = false; }
}

function syncModelFromSideEditor() {
  if (!textContentEditor || syncingRichEditors) return;
  syncingRichEditors = true;
  try {
    editableText.innerHTML = textContentEditor.innerHTML;
    ensureTextModelNotEmpty();
  } finally { syncingRichEditors = false; }
  syncAnimatedTextModel();
  applyVisualState(Number($('timeline').value) || 0);
}

function syncAnimatedTextModel() {
  if (!animatedText) return;
  const chars = annotateWordIndexes(extractStyledChars(false, editableText));
  animatedText.replaceChildren();
  let i = 0;
  while (i < chars.length) {
    const item = chars[i];
    if (item.ch === '\n') {
      animatedText.appendChild(document.createElement('br'));
      i += 1;
      continue;
    }
    if (/\s/.test(item.ch)) {
      const spaces = [];
      while (i < chars.length && chars[i].ch !== '\n' && /\s/.test(chars[i].ch)) spaces.push(chars[i++]);
      const span = document.createElement('span');
      span.className = 'motion-space';
      appendStyledChars(span, spaces);
      animatedText.appendChild(span);
      continue;
    }
    const wordIndex = item.wordIndex ?? 0;
    const wordChars = [];
    while (i < chars.length && chars[i].ch !== '\n' && !/\s/.test(chars[i].ch)) wordChars.push(chars[i++]);
    const word = document.createElement('span');
    word.className = 'motion-word';
    word.dataset.wordIndex = String(wordIndex);
    appendStyledChars(word, wordChars);
    animatedText.appendChild(word);
  }
}

function updateTextEntrancePreview(time) {
  if (!animatedText || state.mode !== 'text' || state.editing) return;
  const unit = stage.clientWidth / 1080;
  const words = animatedText.querySelectorAll('.motion-word');
  if (!state.wordByWord) {
    const motion = textEntranceAt(time, 0);
    animatedText.classList.toggle('motion-hidden', !motion.visible);
    animatedText.style.transform = `translateY(${motion.offset * unit}px)`;
    words.forEach((word) => {
      // Do not force child visibility to `visible`: that overrides a hidden parent.
      // Whole-text mode is gated exclusively by the parent motion layer.
      word.style.removeProperty('visibility');
      word.style.transform = 'translateY(0)';
    });
    return;
  }
  animatedText.classList.remove('motion-hidden');
  animatedText.style.transform = 'translateY(0)';
  words.forEach((word) => {
    const motion = textEntranceAt(time, Number(word.dataset.wordIndex) || 0);
    word.style.visibility = motion.visible ? 'visible' : 'hidden';
    word.style.transform = `translateY(${motion.offset * unit}px)`;
  });
}

function updateStageUnit() {
  const unit = stage.clientWidth / 1080;
  stage.style.setProperty('--stage-unit', `${unit}px`);
  applyVisualState(Number($('timeline').value) || 0);
}

function animatedScaleAt(t) {
  return Math.max(0.1, (state.scale / 100) * (1 - 0.02 * Math.max(0, t)));
}

function applyVisualState(time = Number($('timeline').value) || 0) {
  object.style.left = `${state.x}%`;
  object.style.top = `${state.y}%`;
  object.style.width = `${(state.width / 1080) * 100}%`;
  // The automatic scale is a single parent transform, so word staggering never changes scale per word.
  object.style.transform = `translate(-50%, -50%) scale(${animatedScaleAt(time)})`;

  const unit = stage.clientWidth / 1080;
  for (const layer of [editableText, animatedText]) {
    if (!layer) continue;
    layer.style.fontSize = `${state.fontSize * unit}px`;
    layer.style.color = state.color;
    layer.style.letterSpacing = `${state.tracking * unit}px`;
    layer.style.lineHeight = `${state.lineHeight / 100}`;
    layer.style.textAlign = state.align;
  }
  if (textContentEditor) {
    const sideScale = Math.min(0.44, Math.max(0.26, 32 / Math.max(16, state.fontSize)));
    textContentEditor.style.fontSize = `${state.fontSize * sideScale}px`;
    textContentEditor.style.color = state.color;
    textContentEditor.style.letterSpacing = `${state.tracking * sideScale}px`;
    textContentEditor.style.lineHeight = `${state.lineHeight / 100}`;
    textContentEditor.style.textAlign = state.align;
  }
  updateTextEntrancePreview(time);

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
  animatedText?.classList.toggle('is-hidden', !text);
  document.querySelector('.word-by-word-row')?.classList.toggle('is-hidden', !text);
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
  if (!previewMasterVideo.paused) pausePreview();
  // Direct canvas editing always happens at/after the entrance frame; the external editor works at any time.
  const now = Number($('timeline').value) || 0;
  if (now < TEXT_ENTRANCE_START) syncAt(TEXT_ENTRANCE_START);
  state.editing = true;
  activeTextEditor = editableText;
  savedTextRoot = editableText;
  object.classList.add('is-editing', 'is-selected');
  editableText.contentEditable = 'true';
  editableText.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  if (restoreSelection && savedTextRange && savedTextRoot === editableText) {
    try { sel.addRange(savedTextRange.cloneRange()); return; } catch (_) {}
  }
  const range = document.createRange();
  range.selectNodeContents(editableText);
  range.collapse(false);
  sel.addRange(range);
}

function exitTextEdit() {
  if (!state.editing) return;
  state.editing = false;
  hideMobileSelectionToolbar();
  object.classList.remove('is-editing');
  editableText.contentEditable = 'false';
  window.getSelection()?.removeAllRanges();
  syncSideEditorFromModel();
  syncAnimatedTextModel();
  applyVisualState(Number($('timeline').value) || 0);
}

function syncAfterRichTextMutation(root) {
  if (root === textContentEditor) {
    syncModelFromSideEditor();
  } else {
    ensureTextModelNotEmpty();
    syncSideEditorFromModel();
    syncAnimatedTextModel();
    applyVisualState(Number($('timeline').value) || 0);
  }
}

function applyFontToSelection(fontKey) {
  if (state.mode !== 'text') return;
  const family = FONT_NAMES[fontKey] || FONT_NAMES.EzerSemiBold;

  if (savedSelectionIsUsable()) {
    try {
      const root = savedTextRoot;
      const range = savedTextRange.cloneRange();
      const fragment = range.extractContents();
      const span = document.createElement('span');
      span.style.fontFamily = family;
      span.appendChild(fragment);
      // Font selection replaces inherited font-family but keeps other inline content.
      span.querySelectorAll('[style]').forEach((el) => {
        if (el.style.fontFamily) el.style.removeProperty('font-family');
      });
      range.insertNode(span);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      savedTextRange = nextRange;
      activeTextEditor = root;
      syncAfterRichTextMutation(root);
      return;
    } catch (_) {}
  }

  // With no selection, retain the original canvas-edit fallback.
  if (!state.editing) enterTextEdit(false);
  editableText.focus({ preventScroll: true });
  try {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('fontName', false, family);
    const sel = window.getSelection();
    if (sel?.rangeCount && textEditorContainingNode(sel.anchorNode)) {
      savedTextRoot = textEditorContainingNode(sel.anchorNode);
      savedTextRange = sel.getRangeAt(0).cloneRange();
    }
    syncAfterRichTextMutation(editableText);
  } catch (_) {}
}

function updateActiveFontFromSelection() {
  const sel = window.getSelection();
  const root = sel?.anchorNode ? textEditorContainingNode(sel.anchorNode) : null;
  if (!sel || !root) return;
  activeTextEditor = root;
  savedTextRoot = root;
  if (sel.rangeCount && !sel.isCollapsed) savedTextRange = sel.getRangeAt(0).cloneRange();
  const el = sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : sel.anchorNode;
  if (!el) return;
  const family = getComputedStyle(el).fontFamily.replace(/["']/g, '');
  const key = Object.keys(FONT_NAMES).find((k) => family.includes(FONT_NAMES[k]));
  if (key) {
    $('fontSelect').value = key;
    setMobileFontUi(key);
  }
  if (mobileQuery.matches) refreshMobileSelectionToolbarFromSelection();
}

$('fontSelect').addEventListener('change', (e) => applyFontToSelection(e.target.value));
wordByWordToggle?.addEventListener('change', (e) => {
  state.wordByWord = !!e.target.checked;
  applyVisualState(Number($('timeline').value) || 0);
});
document.addEventListener('selectionchange', () => {
  updateActiveFontFromSelection();
  if (mobileQuery.matches) refreshMobileSelectionToolbarFromSelection();
});

$('fontSize').addEventListener('input', (e) => {
  state.fontSize = clamp(e.target.value, 16, 300);
  syncMobileSelectionControls();
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
  syncMobileSelectionControls();
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
  if (state.mode === 'text') {
    if (state.editing) {
      if (savedSelectionIsUsable()) showMobileSelectionToolbar();
      else showToast('Select the text you want to style.');
    } else openMobileInspector();
  } else { state.width = 1000; state.scale = 100; applyVisualState(); showToast('Media size reset.'); }
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
  ensureTextModelNotEmpty();
  syncSideEditorFromModel();
  syncAnimatedTextModel();
  applyVisualState(Number($('timeline').value) || 0);
});
editableText.addEventListener('focus', () => {
  activeTextEditor = editableText;
  savedTextRoot = editableText;
});
editableText.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); exitTextEdit(); stage.focus(); }
});
editableText.addEventListener('blur', () => {
  setTimeout(() => {
    const active = document.activeElement;
    if (active !== $('fontSelect') && active !== textContentEditor && !editableText.contains(active) && !mobileSelectionToolbar?.contains(active)) exitTextEdit();
  }, 0);
});
editableText.addEventListener('pointerup', () => {
  if (mobileQuery.matches && state.editing) setTimeout(refreshMobileSelectionToolbarFromSelection, 0);
});
editableText.addEventListener('keyup', () => {
  if (mobileQuery.matches && state.editing) setTimeout(refreshMobileSelectionToolbarFromSelection, 0);
});

textContentEditor?.addEventListener('focus', () => {
  activeTextEditor = textContentEditor;
  savedTextRoot = textContentEditor;
});
textContentEditor?.addEventListener('input', () => {
  if (syncingRichEditors) return;
  syncModelFromSideEditor();
});
textContentEditor?.addEventListener('pointerup', () => setTimeout(refreshMobileSelectionToolbarFromSelection, 0));
textContentEditor?.addEventListener('keyup', () => setTimeout(refreshMobileSelectionToolbarFromSelection, 0));
// Keep pasted content clean while preserving the active font at the caret.
textContentEditor?.addEventListener('paste', (e) => {
  e.preventDefault();
  const plain = e.clipboardData?.getData('text/plain') || '';
  document.execCommand('insertText', false, plain);
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

// Template preview. Keep the original video-clock architecture; only add native looping/autoplay.
function refreshTemplateDuration() {
  const candidates = [
    { video: bgVideo, duration: bgVideo.duration },
    { video: fgVideo, duration: fgVideo.duration },
    ...(state.closingLogoAvailable ? [{ video: fg2Video, duration: fg2Video.duration }] : []),
  ].filter((item) => Number.isFinite(item.duration) && item.duration > 0);
  const longest = candidates.reduce((best, item) => !best || item.duration > best.duration ? item : best, null);
  if (!longest) return false;

  const oldMaster = previewMasterVideo;
  const wasPlaying = state.templateReady && oldMaster && !oldMaster.paused;
  const current = Number($('timeline').value) || 0;

  state.duration = longest.duration;
  previewMasterVideo = longest.video;
  for (const video of [bgVideo, fgVideo, fg2Video]) video.loop = false;
  previewMasterVideo.loop = true; // Native master looping is smoother than a pause/seek/play loop.

  $('timeline').max = state.duration;
  $('timeTotal').textContent = formatTime(state.duration);

  if (wasPlaying && oldMaster !== previewMasterVideo) {
    setVideoTime(previewMasterVideo, Math.min(current, state.duration - .001));
    previewMasterVideo.play().catch(() => {});
  }
  return true;
}

function activateTemplateUi() {
  state.templateReady = refreshTemplateDuration();
  if (!state.templateReady) return;
  $('missingAssets').classList.add('is-hidden');
  $('timeline').disabled = false;
  $('playPause').disabled = false;
  $('exportButton').disabled = false;
  fgVideo.muted = true;
  bgVideo.muted = !state.previewAudioUnlocked;
  syncAt(0);
  // Autoplay by default. Muted until the first user gesture so mobile browsers allow it.
  requestAnimationFrame(() => playPreview({ preserveUi: true }));
}

async function initTemplate() {
  bgVideo.src = './assets/bg.webm';
  fgVideo.src = './assets/fg.webm';
  fg2Video.src = './assets/fg2.webm';

  // fg2 loads in parallel and never adds more than 250 ms to initial readiness.
  // Usually its metadata lands before bg+fg and the correct longest master is chosen once.
  const fg2Task = waitForMetadata(fg2Video).then(() => {
    state.closingLogoAvailable = true;
    fg2Video.muted = true;
    closingLogoToggle?.removeAttribute('disabled');
    if (closingLogoToggle) closingLogoToggle.checked = state.closingLogo;
    fg2Video.classList.toggle('is-hidden', !state.closingLogo);
    const current = Number($('timeline').value) || 0;
    refreshTemplateDuration();
    setVideoTime(fg2Video, current);
    if (state.templateReady && (state.closingLogo || previewMasterVideo === fg2Video) && !previewMasterVideo.paused) {
      fg2Video.play().catch(() => {});
    }
    return true;
  }).catch(() => {
    state.closingLogoAvailable = false;
    state.closingLogo = false;
    if (closingLogoToggle) {
      closingLogoToggle.checked = false;
      closingLogoToggle.disabled = false;
    }
    fg2Video.classList.add('is-hidden');
    if (state.templateReady) refreshTemplateDuration();
    return false;
  });

  try {
    await Promise.all([waitForMetadata(bgVideo), waitForMetadata(fgVideo)]);
    await Promise.race([fg2Task, new Promise((resolve) => setTimeout(resolve, 250))]);
    activateTemplateUi();
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
  const safe = Math.min(Math.max(0, Number(t) || 0), Math.max(0, state.duration));
  setVideoTime(bgVideo, safe);
  setVideoTime(fgVideo, safe);
  if (state.closingLogoAvailable) setVideoTime(fg2Video, safe);
  if (state.mediaType === 'video') setVideoTime(mediaVideo, safe % Math.max(.001, mediaVideo.duration || state.duration));
  $('timeline').value = safe;
  $('timeNow').textContent = formatTime(safe);
  state.lastPreviewTime = safe;
  applyVisualState(safe);
}

$('timeline').addEventListener('input', (e) => {
  // Scrubbing is intentionally the same simple pause+seek path as the stable build.
  pausePreview();
  syncAt(Number(e.target.value));
});
$('playPause').addEventListener('click', () => previewMasterVideo.paused ? playPreview() : pausePreview());

async function playPreview({ preserveUi = false } = {}) {
  if (!state.templateReady) return;
  if (!preserveUi) {
    closeMobileInspector();
    object.classList.remove('is-selected');
  }
  let current = Number($('timeline').value) || 0;
  if (current >= state.duration - .02) { syncAt(0); current = 0; }
  setVideoTime(bgVideo, current);
  setVideoTime(fgVideo, current);
  if (state.closingLogoAvailable) setVideoTime(fg2Video, current);
  if (state.mediaType === 'video') setVideoTime(mediaVideo, current % Math.max(.001, mediaVideo.duration || state.duration));
  state.lastPreviewTime = current;
  try {
    await previewMasterVideo.play();
    if (previewMasterVideo !== bgVideo) bgVideo.play().catch(() => {});
    if (previewMasterVideo !== fgVideo) fgVideo.play().catch(() => {});
    if (state.closingLogoAvailable && (state.closingLogo || previewMasterVideo === fg2Video) && previewMasterVideo !== fg2Video) fg2Video.play().catch(() => {});
    if (state.mode === 'media' && state.mediaType === 'video') mediaVideo.play().catch(() => {});
    $('playGlyph').innerHTML = '<path d="M6.5 5h2.5v10H6.5zM11 5h2.5v10H11z"/>';
    cancelAnimationFrame(state.raf);
    tickPreview();
  } catch (_) {
    // Autoplay can be blocked on some browsers. Controls remain usable; first tap can start it.
    $('playGlyph').innerHTML = '<path d="m7 5 8 5-8 5z"/>';
  }
}

function pausePreview() {
  bgVideo.pause(); fgVideo.pause(); fg2Video.pause(); mediaVideo.pause();
  cancelAnimationFrame(state.raf);
  $('playGlyph').innerHTML = '<path d="m7 5 8 5-8 5z"/>';
}

function replaySecondaryLayersAt(t) {
  const playIfNeeded = (video, shouldPlay = true) => {
    if (!video || video === previewMasterVideo || !Number.isFinite(video.duration)) return;
    setVideoTime(video, t);
    if (shouldPlay) video.play().catch(() => {});
  };
  playIfNeeded(bgVideo, true);
  playIfNeeded(fgVideo, true);
  if (state.closingLogoAvailable) playIfNeeded(fg2Video, state.closingLogo || previewMasterVideo === fg2Video);
  if (state.mode === 'media' && state.mediaType === 'video' && mediaVideo.duration) {
    setVideoTime(mediaVideo, t % mediaVideo.duration);
    mediaVideo.play().catch(() => {});
  }
}

function tickPreview() {
  if (previewMasterVideo.paused) return;
  const t = previewMasterVideo.currentTime;
  const wrapped = t + .15 < state.lastPreviewTime;
  if (wrapped) replaySecondaryLayersAt(t);
  state.lastPreviewTime = t;

  $('timeline').value = Math.min(t, state.duration);
  $('timeNow').textContent = formatTime(t);
  const syncTemplateVideo = (video) => {
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video === previewMasterVideo) return;
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
  state.raf = requestAnimationFrame(tickPreview);
}

function unlockPreviewAudio() {
  if (state.previewAudioUnlocked) return;
  state.previewAudioUnlocked = true;
  bgVideo.muted = false;
}
document.addEventListener('pointerdown', unlockPreviewAudio, { once: true, capture: true });
document.addEventListener('keydown', unlockPreviewAudio, { once: true, capture: true });

// Rich text extraction for canvas rendering.
function fontKeyForElement(el) {
  const family = getComputedStyle(el).fontFamily.replace(/["']/g, '');
  return Object.keys(FONT_NAMES).find((k) => family.includes(FONT_NAMES[k])) || 'EzerSemiBold';
}
function extractStyledChars(includeFallback = true, root = editableText) {
  const chars = [];
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const key = fontKeyForElement(node.parentElement || root);
      for (const ch of node.nodeValue || '') chars.push({ ch, font: key });
      return;
    }
    if (node.nodeName === 'BR') { chars.push({ ch: '\n', font: 'EzerSemiBold' }); return; }
    const isBlock = node !== root && /^(DIV|P)$/.test(node.nodeName);
    if (isBlock && chars.length && chars[chars.length - 1].ch !== '\n') chars.push({ ch: '\n', font: 'EzerSemiBold' });
    for (const child of node.childNodes) walk(child);
  };
  walk(root);
  while (chars.length && chars[chars.length - 1].ch === '\n') chars.pop();
  return chars.length ? chars : (includeFallback ? [{ ch: ' ', font: 'EzerSemiBold' }] : []);
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
  const chars = annotateWordIndexes(extractStyledChars());
  const lines = layoutText(ctx, chars);
  const linePx = state.fontSize * state.lineHeight / 100;
  const totalHeight = linePx * lines.length;
  const s = animatedScaleAt(time);
  ctx.save();
  ctx.translate(1080 * state.x / 100, 1920 * state.y / 100);
  // One uniform automatic scale for the complete text layer.
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
      const measured = ctx.measureText(item.ch).width;
      if (!/\s/.test(item.ch)) {
        const motion = textEntranceAt(time, state.wordByWord ? (item.wordIndex ?? 0) : 0);
        if (motion.visible) ctx.fillText(item.ch, x, y + motion.offset);
      }
      x += measured + state.tracking;
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
syncSideEditorFromModel(true);
syncAnimatedTextModel();
if (wordByWordToggle) wordByWordToggle.checked = state.wordByWord;
applyVisualState(0);
initTemplate();

setMobileFontUi('EzerSemiBold');
syncMobileSelectionControls();
