# Toolbox Video Maker

A small static client-side video production tool designed for GitHub Pages.

## What it does

- Uses `assets/bg.webm` as the full-frame background.
- Uses `assets/fg.webm` as the transparent foreground overlay.
- Places one editable middle layer between them:
  - Rich text with per-selection font choice, or
  - A user-uploaded image/video.
- The middle layer starts centered and can be dragged and scaled.
- Text shrinks **linearly by 2% per second** from its user-set base size.
- Export is **1080×1920, 30 fps, H.264 MP4, 20 Mbps video**.
- Export duration is taken from `bg.webm`.
- Only audio from `bg.webm` is included.
- User media never leaves the browser.

## Included fonts

Only these supplied fonts are exposed in the editor:

- Ezer Standard Light
- Ezer Standard Book
- Ezer Standard Regular
- Ezer Standard SemiBold
- Gestura Text Black Italic

The default copy is:

`Meet your new Toolbox`

with `Meet your new ` in Ezer Standard SemiBold and `Toolbox` in Gestura Text Black Italic.

## Add the two template videos

The two video attachments were not available when this package was generated.

Put your files here with these exact names:

```text
assets/bg.webm
assets/fg.webm
```

Both should have the same duration. `fg.webm` must contain alpha transparency.

Recommended template dimensions: **1080×1920**.

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload the contents of this folder to the repository root.
3. Make sure `assets/bg.webm` and `assets/fg.webm` are present.
4. In GitHub: **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the `main` branch and `/ (root)` folder.
7. Save.

No server, database, API keys, or build step are required.

## Browser recommendation

Use a current desktop Chrome or Edge build for export. The tool uses WebCodecs for hardware-accelerated H.264 rendering and Mediabunny for media decoding/muxing. AAC is polyfilled when the browser does not provide a native AAC encoder.

## Local testing

Do not open `index.html` directly with `file://`, because browsers restrict asset fetching in that mode.

From this folder, run for example:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Notes on uploaded media

The file picker accepts common image/video formats. Actual video decoding support depends on the browser and codec. If a particular uploaded codec cannot be decoded in-browser, export will show a clear error instead of silently producing a broken file.
