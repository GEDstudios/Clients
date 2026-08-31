# Toolbox Composer

A static, client-side social video composition tool designed for GitHub Pages.

## Required template assets

Place these two files in `assets/`:

- `assets/bg.webm` — background video. Its duration is the output duration and its audio is the only audio used.
- `assets/fg.webm` — foreground video with alpha/transparency. It should match the background duration.

The included fonts are already wired into the editor:

- Ezer Standard Light
- Ezer Standard Book
- Ezer Standard Regular
- Ezer Standard SemiBold
- Gestura Text Black Italic

## Editor behavior

- Output: 1080×1920, 30 fps, H.264 MP4, high bitrate.
- Text is centered by default and starts at `#F3F3F3`.
- Default copy: “Meet your new Toolbox”. “Toolbox” uses Gestura Text Black Italic.
- The middle layer can be rich text or uploaded image/video.
- Text fonts can be changed on a text selection.
- Direct manipulation: drag the object, resize its text/media box with side handles, scale with corner handles, double-click text to edit.
- The middle layer shrinks linearly by 2% per second in preview and export.
- Media and foreground audio are muted; only `bg.webm` audio is exported.

## Run locally

Because the editor loads media and an ES module, use a local web server instead of opening `index.html` directly.

For example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

1. Upload the project contents to a GitHub repository.
2. Add your `bg.webm` and `fg.webm` inside the `assets` folder.
3. In repository Settings → Pages, deploy from the main branch/root.
4. Open the generated GitHub Pages URL in current Chrome or Edge for the most reliable client-side H.264/AAC export.

No server, database, login, or uploaded-media storage is used. User media stays in the browser.
