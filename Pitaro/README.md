# Pitaro Toolbox

Campaign marketing tool by [Guy X10](https://x10guy.studio).

Clients pick a template, drop in their message or artwork, and download a
finished MP4. Everything runs in the browser — no server, no uploads, no
accounts. Files never leave the client's machine.

```
index.html      the tool your clients use
admin.html      the template builder (for you)
presets.json    the published templates
media/          template video files
assets/         fonts, styles, scripts
test/           headless test suites
```

---

## Publishing to GitHub Pages

1. Push this folder to a repository.
2. **Settings → Pages → Source:** *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. Your clients use `https://<user>.github.io/<repo>/`.

`.nojekyll` is already included so folders starting with an underscore
are served correctly.

Send clients the plain URL. Keep `admin.html` to yourself — it is marked
`noindex`, but anyone with the link can open it, so treat the URL as
private. It only edits a local draft; nothing is published until you
commit a new `presets.json`.

### Running it locally

Templates load over `fetch`, which browsers block on `file://`. Use any
static server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## Making templates

Open `admin.html`.

1. **New template**, give it a name.
2. Set the frame size, frames per second and duration. Exports match
   these numbers exactly.
3. Point the layers at files in `media/`. Drop a file on a field to fill
   in the path and read its size and duration automatically — the file
   itself still needs committing to the repo.
4. Drag the text sample on the preview to set where your clients' text
   starts.
5. Untick anything you do not want clients changing.
6. **Preview** opens the real tool with your unsaved draft.
7. **Download presets.json**, replace the file in the repo root, push.

Your work autosaves to your browser as a draft. Only `presets.json` in
the repository is live.

### Preparing the layers

**Background** — plain MP4, H.264, `yuv420p`.

```bash
ffmpeg -i source.mov -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -g 15 -movflags +faststart media/name-bg.mp4
```

`-g 15` puts a keyframe every half second. Export works by seeking to
each frame in turn, so dense keyframes make it several times faster.
This matters more than file size.

**Foreground (transparent)** — this is the important one. Browsers
cannot decode ProRes 4444 or animation-codec QuickTime. Convert your
alpha overlay to **WebM / VP9 with an alpha channel**:

```bash
ffmpeg -i overlay.mov -c:v libvpx-vp9 -pix_fmt yuva420p \
  -crf 30 -b:v 0 -g 15 -auto-alt-ref 0 media/name-fg.webm
```

`-pix_fmt yuva420p` and `-auto-alt-ref 0` are both required; without
them the alpha is silently discarded. Check it survived:

```bash
ffprobe -v error -show_entries stream_tags=ALPHA_MODE media/name-fg.webm
```

Safari does not play VP9 alpha. If you need it, also export HEVC with
alpha as a `.mov` and set it as the Safari fallback — the tool picks
whichever the browser can play.

**Card image** — any JPG. Optional; the tool falls back to the
background video.

---

## What clients can do

- Choose a template.
- **Text:** type on the video, or in the side panel. Change typeface,
  weight, size, colour and alignment. Select individual words first to
  style only those — including a different typeface per word. Hebrew and
  mixed Hebrew/English are handled by the browser's own text engine, so
  RTL and bidirectional runs lay out correctly.
- **Image or video:** drop in a file. A clip shorter than the template
  repeats rather than freezing.
- Drag to move, corners to scale, top dot to rotate, arrow keys to
  nudge. Guides appear when the layer hits centre.
- Export MP4 at the template's exact size, 30 fps, in three quality
  tiers (High is roughly 15 Mbps at 1080×1920).

The default is Ezer Standard SemiBold in `#F3F3F3`, as specified.

---

## How it works

The middle layer sits between a background video and a foreground video
with an alpha channel, exactly as a compositor would stack them.

**Preview** is plain DOM. A VP9-alpha `<video>` renders transparently in
the browser, so the overlay composites over live, editable text with no
canvas in the loop. The stage is built at true composition size — a
1080×1920 template is a 1080×1920 element — and scaled down with CSS, so
every number in the app is already in export pixels and the preview is
positionally identical to the output.

**Export** switches to canvas. Each frame seeks both videos to an exact
timestamp, composites, and hands a `VideoFrame` to a WebCodecs
`VideoEncoder`, muxed to MP4 by a vendored copy of `mp4-muxer`. Text is
rasterised once at 2× through an SVG `foreignObject` with the fonts
base64-embedded, so exported type is crisp and matches what was on
screen. If a browser refuses `foreignObject`, a canvas text layout takes
over automatically.

Audio is optional: the template's track and the client's own clip are
decoded, mixed in an `OfflineAudioContext` and encoded to AAC. The audio
is decoded before the muxer is configured, so a failed decode produces a
silent video rather than a file with a broken track.

**Browser support.** Chrome, Edge and Safari 17+ produce MP4. Firefox
lacks a WebCodecs H.264 encoder and falls back to WebM, with a notice in
the interface.

**A note on external media.** Everything here is same-origin, so canvas
export works. If you ever host template videos on another domain, that
domain must send `Access-Control-Allow-Origin` or the canvas becomes
tainted and export will fail.

---

## Tests

```bash
npm install jsdom
node test/engine.test.mjs     # 87 checks — sanitiser, presets, geometry, seeking
node test/app.dom.test.mjs    # 71 checks — boots index.html and drives all three steps
```

The engine suite covers HTML sanitising (scripts, event handlers,
`javascript:` and `url()` in styles are all stripped), rich-text round
trips including Hebrew and blank lines, preset normalisation, cover-fit
geometry, layer ordering and short-clip looping. The DOM suite boots the
real page and walks a client through picking a template, typing,
restyling single words, moving the layer and switching templates.

---

## Customising the look

Every colour, radius and typeface lives in one block at the top of
`assets/css/app.css`. Change `--tally` to move the accent, `--paper` and
`--ink` for the light/dark balance.

Adding a typeface: drop a `.woff2` into `assets/fonts/`, add an
`@font-face` in `assets/fonts/fonts.css`, and add an entry to the
`FONTS` array in `assets/js/engine.js`. The array drives the client
controls, the admin form and the fonts embedded in the export, so one
edit covers all three.

---

## Included demo templates

Three working templates ship with the tool — Story 9:16, Square 1:1 and
Landscape 16:9 — so it runs the moment you open it. They use the Pitaro
wordmark and the hairline rule from the mark as a real VP9-alpha
overlay. Replace them with your own campaign artwork; they are only
there to prove the pipeline.
