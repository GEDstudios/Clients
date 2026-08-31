import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeAudio,
  canEncodeVideo,
} from 'https://cdn.jsdelivr.net/npm/mediabunny@1.55.4/+esm';
import { registerAacEncoder } from 'https://cdn.jsdelivr.net/npm/@mediabunny/aac-encoder@1.55.4/+esm';

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const BASE_TEXT_SIZE = 92;
const TEXT_GROWTH_PER_SECOND = 0.02;
const VIDEO_BITRATE = 20_000_000;
const AUDIO_BITRATE = 256_000;

const $ = (id) => document.getElementById(id);
const els = {
  assetStatus: $('assetStatus'),
  textModeBtn: $('textModeBtn'),
  mediaModeBtn: $('mediaModeBtn'),
  textControls: $('textControls'),
  mediaControls: $('mediaControls'),
  richTextEditor: $('richTextEditor'),
  fontSelect: $('fontSelect'),
  mediaInput: $('mediaInput'),
  dropZone: $('dropZone'),
  dropLabel: $('dropLabel'),
  removeMediaBtn: $('removeMediaBtn'),
  centerBtn: $('centerBtn'),
  scaleSlider: $('scaleSlider'),
  scaleOutput: $('scaleOutput'),
  exportBtn: $('exportBtn'),
  exportProgressWrap: $('exportProgressWrap'),
  exportProgress: $('exportProgress'),
  exportStatus: $('exportStatus'),
  exportPercent: $('exportPercent'),
  stage: $('stage'),
  stagePlaceholder: $('stagePlaceholder'),
  bgVideo: $('bgVideo'),
  fgVideo: $('fgVideo'),
  middleLayer: $('middleLayer'),
  previewText: $('previewText'),
  previewImage: $('previewImage'),
  previewMediaVideo: $('previewMediaVideo'),
  playBtn: $('playBtn'),
  playIcon: $('playIcon'),
  currentTimeLabel: $('currentTimeLabel'),
  durationLabel: $('durationLabel'),
  timeline: $('timeline'),
};

const state = {
  mode: 'text',
  x: 0.5,
  y: 0.5,
  scale: 1,
  duration: 0,
  templateReady: false,
  currentTime: 0,
  isPlaying: false,
  raf: 0,
  savedRange: null,
  mediaFile: null,
  mediaKind: null,
  mediaUrl: null,
  exporting: false,
};

const fontMap = [
  ['GesturaBlackItalic', 'GesturaBlackItalic'],
  ['EzerSemiBold', 'EzerSemiBold'],
  ['EzerRegular', 'EzerRegular'],
  ['EzerBook', 'EzerBook'],
  ['EzerLight', 'EzerLight'],
];

function knownFontFromCss(value = '') {
  const clean = value.replaceAll('"', '').replaceAll("'", '');
  for (const [needle, family] of fontMap) {
    if (clean.includes(needle)) return family;
  }
  return 'EzerSemiBold';
}

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe - mins * 60;
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
}

function setMode(mode) {
  state.mode = mode;
  const text = mode === 'text';
  els.textModeBtn.classList.toggle('is-active', text);
  els.mediaModeBtn.classList.toggle('is-active', !text);
  els.textControls.classList.toggle('is-hidden', !text);
  els.mediaControls.classList.toggle('is-hidden', text);
  els.previewText.classList.toggle('is-hidden', !text);
  els.previewImage.classList.toggle('is-hidden', text || state.mediaKind !== 'image');
  els.previewMediaVideo.classList.toggle('is-hidden', text || state.mediaKind !== 'video');
  renderPreviewTransform();
}

function syncPreviewText() {
  els.previewText.innerHTML = els.richTextEditor.innerHTML;
  renderPreviewTransform();
}

function saveEditorSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (els.richTextEditor.contains(range.commonAncestorContainer)) {
    state.savedRange = range.cloneRange();
  }
}

function restoreEditorSelection() {
  if (!state.savedRange) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(state.savedRange);
  return true;
}

function applyFontToSelection(fontFamily) {
  els.richTextEditor.focus();
  restoreEditorSelection();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  document.execCommand('fontName', false, fontFamily);
  saveEditorSelection();
  syncPreviewText();
}

function renderPreviewTransform() {
  const time = state.currentTime || 0;
  const growth = state.mode === 'text' ? 1 + TEXT_GROWTH_PER_SECOND * time : 1;
  const visualScale = state.scale * growth;
  els.middleLayer.style.left = `${state.x * 100}%`;
  els.middleLayer.style.top = `${state.y * 100}%`;
  els.middleLayer.style.transform = `translate(-50%, -50%) scale(${visualScale})`;

  const previewScale = els.stage.clientWidth / WIDTH;
  els.previewText.style.fontSize = `${BASE_TEXT_SIZE * previewScale}px`;
  els.previewText.style.maxWidth = `${WIDTH * 0.88 * previewScale}px`;

  if (state.mediaKind === 'image' && els.previewImage.naturalWidth) {
    setPreviewMediaBaseSize(els.previewImage.naturalWidth, els.previewImage.naturalHeight);
  } else if (state.mediaKind === 'video' && els.previewMediaVideo.videoWidth) {
    setPreviewMediaBaseSize(els.previewMediaVideo.videoWidth, els.previewMediaVideo.videoHeight);
  }
}

function setPreviewMediaBaseSize(naturalW, naturalH) {
  const stageW = els.stage.clientWidth;
  const stageH = els.stage.clientHeight;
  const maxW = stageW * 0.7;
  const maxH = stageH * 0.55;
  const fit = Math.min(maxW / naturalW, maxH / naturalH);
  const target = state.mediaKind === 'image' ? els.previewImage : els.previewMediaVideo;
  target.style.width = `${naturalW * fit}px`;
  target.style.height = `${naturalH * fit}px`;
}

function centerLayer() {
  state.x = 0.5;
  state.y = 0.5;
  renderPreviewTransform();
}

function updateTime(time, syncVideos = false) {
  const duration = state.duration || 0;
  state.currentTime = Math.max(0, Math.min(time, duration || time));
  els.timeline.value = String(state.currentTime);
  els.currentTimeLabel.textContent = formatTime(state.currentTime);
  renderPreviewTransform();

  if (syncVideos && state.templateReady) {
    const t = Math.min(state.currentTime, Math.max(0, state.duration - 0.001));
    if (Math.abs(els.bgVideo.currentTime - t) > 0.03) els.bgVideo.currentTime = t;
    if (Math.abs(els.fgVideo.currentTime - t) > 0.03) els.fgVideo.currentTime = t;
    syncMiddleMediaTime(t);
  }
}

function syncMiddleMediaTime(t) {
  if (state.mode !== 'media' || state.mediaKind !== 'video' || !Number.isFinite(els.previewMediaVideo.duration)) return;
  const mediaDuration = els.previewMediaVideo.duration;
  if (mediaDuration <= 0) return;
  const mediaT = Math.min(t, Math.max(0, mediaDuration - 0.001));
  if (Math.abs(els.previewMediaVideo.currentTime - mediaT) > 0.08) {
    els.previewMediaVideo.currentTime = mediaT;
  }
  if (t >= mediaDuration) els.previewMediaVideo.pause();
}

async function togglePlayback() {
  if (!state.templateReady) return;
  if (state.isPlaying) {
    pausePlayback();
    return;
  }
  if (state.currentTime >= state.duration - 0.02) updateTime(0, true);
  state.isPlaying = true;
  els.playIcon.textContent = 'Ⅱ';
  els.playBtn.setAttribute('aria-label', 'Pause preview');
  await syncPlayStart();
  tickPlayback();
}

async function syncPlayStart() {
  const t = state.currentTime;
  els.bgVideo.currentTime = t;
  els.fgVideo.currentTime = t;
  syncMiddleMediaTime(t);
  const promises = [els.bgVideo.play(), els.fgVideo.play()];
  if (state.mode === 'media' && state.mediaKind === 'video' && t < els.previewMediaVideo.duration) {
    promises.push(els.previewMediaVideo.play());
  }
  await Promise.allSettled(promises);
}

function pausePlayback() {
  state.isPlaying = false;
  cancelAnimationFrame(state.raf);
  els.bgVideo.pause();
  els.fgVideo.pause();
  els.previewMediaVideo.pause();
  els.playIcon.textContent = '▶';
  els.playBtn.setAttribute('aria-label', 'Play preview');
  updateTime(els.bgVideo.currentTime || state.currentTime);
}

function tickPlayback() {
  if (!state.isPlaying) return;
  const t = els.bgVideo.currentTime;
  updateTime(t);
  if (state.mode === 'media' && state.mediaKind === 'video') syncMiddleMediaTime(t);
  if (t >= state.duration - 0.01 || els.bgVideo.ended) {
    pausePlayback();
    updateTime(state.duration);
    return;
  }
  state.raf = requestAnimationFrame(tickPlayback);
}

function clearMedia() {
  els.previewMediaVideo.pause();
  if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
  state.mediaFile = null;
  state.mediaKind = null;
  state.mediaUrl = null;
  els.mediaInput.value = '';
  els.previewImage.removeAttribute('src');
  els.previewMediaVideo.removeAttribute('src');
  els.previewImage.classList.add('is-hidden');
  els.previewMediaVideo.classList.add('is-hidden');
  els.removeMediaBtn.classList.add('is-hidden');
  els.dropLabel.textContent = 'Choose a file';
}

function inferMediaKind(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','webp','gif','avif','bmp','svg'].includes(ext)) return 'image';
  if (['mp4','mov','m4v','webm','mkv','avi','mpeg','mpg'].includes(ext)) return 'video';
  return null;
}

function loadMediaFile(file) {
  clearMedia();
  const kind = inferMediaKind(file);
  if (!kind) {
    els.dropLabel.textContent = 'Unsupported file type';
    return;
  }
  state.mediaFile = file;
  state.mediaKind = kind;
  state.mediaUrl = URL.createObjectURL(file);
  els.dropLabel.textContent = file.name;
  els.removeMediaBtn.classList.remove('is-hidden');

  if (kind === 'image') {
    els.previewImage.src = state.mediaUrl;
    els.previewImage.onload = () => {
      setPreviewMediaBaseSize(els.previewImage.naturalWidth, els.previewImage.naturalHeight);
      if (state.mode === 'media') els.previewImage.classList.remove('is-hidden');
    };
  } else {
    els.previewMediaVideo.src = state.mediaUrl;
    els.previewMediaVideo.onloadedmetadata = () => {
      setPreviewMediaBaseSize(els.previewMediaVideo.videoWidth, els.previewMediaVideo.videoHeight);
      syncMiddleMediaTime(state.currentTime);
      if (state.mode === 'media') els.previewMediaVideo.classList.remove('is-hidden');
    };
  }
  renderPreviewTransform();
}

async function fetchAsset(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.blob();
}

async function loadTemplate() {
  els.assetStatus.dataset.state = 'loading';
  els.assetStatus.textContent = 'Loading template…';
  try {
    const [bgBlob, fgBlob] = await Promise.all([
      fetchAsset('./assets/bg.webm'),
      fetchAsset('./assets/fg.webm'),
    ]);
    els.bgVideo.src = URL.createObjectURL(bgBlob);
    els.fgVideo.src = URL.createObjectURL(fgBlob);

    await Promise.all([
      new Promise((resolve, reject) => {
        els.bgVideo.onloadedmetadata = resolve;
        els.bgVideo.onerror = reject;
      }),
      new Promise((resolve, reject) => {
        els.fgVideo.onloadedmetadata = resolve;
        els.fgVideo.onerror = reject;
      }),
    ]);

    state.duration = els.bgVideo.duration;
    if (!Number.isFinite(state.duration) || state.duration <= 0) throw new Error('Invalid background duration');
    if (Math.abs(els.fgVideo.duration - state.duration) > 0.05) {
      console.warn('Foreground and background durations differ.', els.fgVideo.duration, state.duration);
    }

    state.templateReady = true;
    els.stagePlaceholder.classList.add('is-hidden');
    els.timeline.max = String(state.duration);
    els.timeline.disabled = false;
    els.playBtn.disabled = false;
    els.exportBtn.disabled = false;
    els.durationLabel.textContent = formatTime(state.duration);
    els.assetStatus.dataset.state = 'ready';
    els.assetStatus.textContent = `${formatTime(state.duration)} template ready`;
    updateTime(0, true);
  } catch (error) {
    console.warn(error);
    state.templateReady = false;
    els.assetStatus.dataset.state = 'error';
    els.assetStatus.textContent = 'Template videos missing';
    els.exportBtn.disabled = true;
  }
}

function createInput(blob) {
  return new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
}

function flattenRichText(root) {
  const chars = [];
  const walk = (node, inheritedFont = 'EzerSemiBold') => {
    if (node.nodeType === Node.TEXT_NODE) {
      for (const char of [...node.nodeValue]) chars.push({ char, font: inheritedFont });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node;
    if (element.tagName === 'BR') {
      chars.push({ char: '\n', font: inheritedFont });
      return;
    }
    const font = knownFontFromCss(getComputedStyle(element).fontFamily || inheritedFont);
    const isBlock = ['DIV', 'P'].includes(element.tagName);
    if (isBlock && chars.length && chars.at(-1).char !== '\n') chars.push({ char: '\n', font });
    for (const child of element.childNodes) walk(child, font);
    if (isBlock && chars.length && chars.at(-1).char !== '\n') chars.push({ char: '\n', font });
  };
  for (const child of root.childNodes) walk(child, 'EzerSemiBold');
  while (chars.length && chars.at(-1).char === '\n') chars.pop();
  return chars;
}

function drawRichText(ctx, chars, x, y, scale) {
  const lines = [[]];
  for (const item of chars) {
    if (item.char === '\n') lines.push([]);
    else lines.at(-1).push(item);
  }
  const lineHeight = BASE_TEXT_SIZE * 1.08;
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111111';

  lines.forEach((line, lineIndex) => {
    const widths = line.map(({ char, font }) => {
      ctx.font = `${font === 'GesturaBlackItalic' ? 'italic ' : ''}${BASE_TEXT_SIZE}px "${font}"`;
      return ctx.measureText(char).width;
    });
    const lineWidth = widths.reduce((sum, w) => sum + w, 0);
    let cursorX = -lineWidth / 2;
    const lineY = -totalHeight / 2 + lineHeight / 2 + lineIndex * lineHeight;
    line.forEach(({ char, font }, index) => {
      ctx.font = `${font === 'GesturaBlackItalic' ? 'italic ' : ''}${BASE_TEXT_SIZE}px "${font}"`;
      ctx.fillText(char, cursorX, lineY);
      cursorX += widths[index];
    });
  });
  ctx.restore();
}

function containSize(srcW, srcH, maxW, maxH) {
  const factor = Math.min(maxW / srcW, maxH / srcH);
  return { w: srcW * factor, h: srcH * factor };
}

function drawMiddleMedia(ctx, source, naturalW, naturalH) {
  const base = containSize(naturalW, naturalH, WIDTH * 0.7, HEIGHT * 0.55);
  const w = base.w * state.scale;
  const h = base.h * state.scale;
  const x = state.x * WIDTH - w / 2;
  const y = state.y * HEIGHT - h / 2;
  ctx.drawImage(source, x, y, w, h);
}

function cropAudioBuffer(buffer, seconds) {
  const frames = Math.max(0, Math.min(buffer.length, Math.round(seconds * buffer.sampleRate)));
  if (frames >= buffer.length) return buffer;
  const trimmed = new AudioBuffer({
    length: frames,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(0, frames), ch);
  }
  return trimmed;
}

function setExportProgress(progress, label) {
  const value = Math.max(0, Math.min(1, progress));
  const pct = Math.round(value * 100);
  els.exportProgress.style.width = `${pct}%`;
  els.exportPercent.textContent = `${pct}%`;
  els.exportStatus.textContent = label;
}

async function exportVideo() {
  if (!state.templateReady || state.exporting) return;
  state.exporting = true;
  pausePlayback();
  els.exportBtn.disabled = true;
  els.exportProgressWrap.classList.remove('is-hidden');
  setExportProgress(0, 'Loading template…');

  try {
    await document.fonts.ready;
    const [bgBlob, fgBlob] = await Promise.all([
      fetchAsset('./assets/bg.webm'),
      fetchAsset('./assets/fg.webm'),
    ]);

    const bgInput = createInput(bgBlob);
    const fgInput = createInput(fgBlob);
    const [bgTrack, fgTrack] = await Promise.all([
      bgInput.getPrimaryVideoTrack(),
      fgInput.getPrimaryVideoTrack(),
    ]);
    if (!bgTrack || !fgTrack) throw new Error('Template video track missing.');
    if (!(await bgTrack.canDecode())) throw new Error('This browser cannot decode bg.webm.');
    if (!(await fgTrack.canDecode())) throw new Error('This browser cannot decode fg.webm.');

    const duration = await bgInput.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not determine template duration.');

    const videoQuality = new Quality({ bitrate: VIDEO_BITRATE });
    if (!(await canEncodeVideo('avc', { width: WIDTH, height: HEIGHT, quality: videoQuality }))) {
      throw new Error('H.264 export is not supported in this browser. Use current Chrome or Edge on desktop.');
    }
    if (!(await canEncodeAudio('aac'))) registerAacEncoder();

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = WIDTH;
    renderCanvas.height = HEIGHT;
    const ctx = renderCanvas.getContext('2d', { alpha: false, desynchronized: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    const videoSource = new CanvasSource(renderCanvas, {
      codec: 'avc',
      quality: videoQuality,
      keyFrameInterval: 2,
    });
    output.addVideoTrack(videoSource, { frameRate: FPS });

    const bgAudioTrack = await bgInput.getPrimaryAudioTrack();
    let audioSource = null;
    let audioSink = null;
    if (bgAudioTrack && await bgAudioTrack.canDecode()) {
      audioSource = new AudioBufferSource({
        codec: 'aac',
        quality: new Quality({ bitrate: AUDIO_BITRATE }),
      });
      output.addAudioTrack(audioSource);
      audioSink = new AudioBufferSink(bgAudioTrack);
    }

    const bgSink = new CanvasSink(bgTrack, { width: WIDTH, height: HEIGHT, fit: 'fill', poolSize: 2 });
    const fgSink = new CanvasSink(fgTrack, { width: WIDTH, height: HEIGHT, fit: 'fill', alpha: true, poolSize: 2 });

    let middleImageBitmap = null;
    let middleVideoSink = null;
    let middleVideoTrack = null;
    let middleDuration = 0;
    let middleInput = null;

    if (state.mode === 'media' && state.mediaFile) {
      if (state.mediaKind === 'image') {
        middleImageBitmap = await createImageBitmap(state.mediaFile);
      } else if (state.mediaKind === 'video') {
        middleInput = createInput(state.mediaFile);
        middleVideoTrack = await middleInput.getPrimaryVideoTrack();
        if (!middleVideoTrack || !(await middleVideoTrack.canDecode())) {
          throw new Error('The uploaded video codec cannot be decoded in this browser.');
        }
        middleDuration = await middleVideoTrack.computeDuration();
        middleVideoSink = new CanvasSink(middleVideoTrack, { alpha: true, poolSize: 2 });
      }
    }

    const textChars = flattenRichText(els.richTextEditor);
    const frameCount = Math.max(1, Math.ceil(duration * FPS - 1e-7));
    const timestamps = Array.from({ length: frameCount }, (_, i) => i / FPS);
    const middleTimestamps = middleVideoSink
      ? timestamps.map((t) => Math.min(t, Math.max(0, middleDuration - 0.000001)))
      : null;

    const bgIterator = bgSink.canvasesAtTimestamps(timestamps);
    const fgIterator = fgSink.canvasesAtTimestamps(timestamps);
    const middleIterator = middleVideoSink ? middleVideoSink.canvasesAtTimestamps(middleTimestamps) : null;

    await output.start();

    const audioPromise = (async () => {
      if (!audioSource || !audioSink) return;
      let audioTime = 0;
      for await (const wrapped of audioSink.buffers(0, duration)) {
        if (audioTime >= duration) break;
        const remaining = duration - audioTime;
        const buffer = wrapped.buffer.duration > remaining
          ? cropAudioBuffer(wrapped.buffer, remaining)
          : wrapped.buffer;
        if (buffer.length > 0) {
          await audioSource.add(buffer);
          audioTime += buffer.duration;
        }
      }
      audioSource.close();
    })();

    setExportProgress(0.02, 'Rendering frames…');

    for (let i = 0; i < frameCount; i += 1) {
      const tasks = [bgIterator.next(), fgIterator.next()];
      if (middleIterator) tasks.push(middleIterator.next());
      const results = await Promise.all(tasks);
      const bgFrame = results[0].value;
      const fgFrame = results[1].value;
      const middleFrame = middleIterator ? results[2].value : null;
      if (!bgFrame || !fgFrame) throw new Error(`Could not decode template frame ${i + 1}.`);

      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.drawImage(bgFrame.canvas, 0, 0, WIDTH, HEIGHT);

      const t = timestamps[i];
      if (state.mode === 'text') {
        const growth = 1 + TEXT_GROWTH_PER_SECOND * t;
        drawRichText(ctx, textChars, state.x * WIDTH, state.y * HEIGHT, state.scale * growth);
      } else if (middleImageBitmap) {
        drawMiddleMedia(ctx, middleImageBitmap, middleImageBitmap.width, middleImageBitmap.height);
      } else if (middleFrame) {
        drawMiddleMedia(ctx, middleFrame.canvas, middleFrame.canvas.width, middleFrame.canvas.height);
      }

      ctx.drawImage(fgFrame.canvas, 0, 0, WIDTH, HEIGHT);
      const frameDuration = i === frameCount - 1
        ? Math.max(1 / 1000, duration - t)
        : 1 / FPS;
      await videoSource.add(t, frameDuration);

      if (i % 3 === 0 || i === frameCount - 1) {
        setExportProgress(0.03 + 0.91 * ((i + 1) / frameCount), `Rendering frame ${i + 1} of ${frameCount}`);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    videoSource.close();
    await audioPromise;
    setExportProgress(0.96, 'Finalizing MP4…');
    await output.finalize();

    if (middleImageBitmap) middleImageBitmap.close();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error('The MP4 encoder returned no output.');
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toolbox-video.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setExportProgress(1, 'Done');
  } catch (error) {
    console.error(error);
    setExportProgress(0, error?.message || 'Export failed');
    alert(`Export failed: ${error?.message || error}`);
  } finally {
    state.exporting = false;
    els.exportBtn.disabled = !state.templateReady;
  }
}

function bindDrag() {
  let pointerId = null;
  const updateFromEvent = (event) => {
    const rect = els.stage.getBoundingClientRect();
    state.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    state.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    renderPreviewTransform();
  };

  els.middleLayer.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointerId = event.pointerId;
    els.middleLayer.setPointerCapture(pointerId);
    els.middleLayer.classList.add('is-dragging');
    updateFromEvent(event);
  });
  els.middleLayer.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    updateFromEvent(event);
  });
  const end = (event) => {
    if (event.pointerId !== pointerId) return;
    els.middleLayer.classList.remove('is-dragging');
    try { els.middleLayer.releasePointerCapture(pointerId); } catch {}
    pointerId = null;
  };
  els.middleLayer.addEventListener('pointerup', end);
  els.middleLayer.addEventListener('pointercancel', end);
}

function bindEvents() {
  els.textModeBtn.addEventListener('click', () => setMode('text'));
  els.mediaModeBtn.addEventListener('click', () => setMode('media'));
  els.richTextEditor.addEventListener('input', syncPreviewText);
  els.richTextEditor.addEventListener('keyup', saveEditorSelection);
  els.richTextEditor.addEventListener('mouseup', saveEditorSelection);
  els.richTextEditor.addEventListener('focus', saveEditorSelection);
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === els.richTextEditor) saveEditorSelection();
  });
  els.richTextEditor.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  els.fontSelect.addEventListener('mousedown', saveEditorSelection);
  els.fontSelect.addEventListener('change', () => applyFontToSelection(els.fontSelect.value));

  els.mediaInput.addEventListener('change', () => {
    const file = els.mediaInput.files?.[0];
    if (file) loadMediaFile(file);
  });
  ['dragenter', 'dragover'].forEach((type) => els.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropZone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach((type) => els.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove('is-dragover');
  }));
  els.dropZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files?.[0];
    if (file) loadMediaFile(file);
  });
  els.removeMediaBtn.addEventListener('click', clearMedia);

  els.scaleSlider.addEventListener('input', () => {
    state.scale = Number(els.scaleSlider.value) / 100;
    els.scaleOutput.textContent = `${els.scaleSlider.value}%`;
    renderPreviewTransform();
  });
  els.centerBtn.addEventListener('click', centerLayer);

  els.playBtn.addEventListener('click', togglePlayback);
  els.timeline.addEventListener('input', () => {
    pausePlayback();
    updateTime(Number(els.timeline.value), true);
  });
  els.bgVideo.addEventListener('ended', () => {
    pausePlayback();
    updateTime(state.duration);
  });
  els.exportBtn.addEventListener('click', exportVideo);
  window.addEventListener('resize', renderPreviewTransform);
  bindDrag();
}

async function init() {
  bindEvents();
  setMode('text');
  syncPreviewText();
  await document.fonts.ready;
  renderPreviewTransform();
  await loadTemplate();
}

init();
