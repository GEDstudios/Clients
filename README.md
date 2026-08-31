# Toolbox Composer

Static, client-side social video compositor for GitHub Pages.

## Required template assets

Place these two files in `assets/`:

- `assets/bg.webm` — background video. Its duration defines the output duration; its audio is the only exported audio.
- `assets/fg.webm` — foreground video with alpha/transparency, matching the background duration.

Included fonts:

- Ezer Standard Light
- Ezer Standard Book
- Ezer Standard Regular
- Ezer Standard SemiBold
- Gestura Text Black Italic

## Editor behavior

- Output: 1080×1920, 30 fps, H.264 MP4, high bitrate.
- Default text size: 80 px.
- Default text box width: 1000 px.
- Default text color: `#F3F3F3`.
- Default copy: “Meet your new Toolbox”; “Toolbox” uses Gestura Text Black Italic.
- Middle layer can be rich text or an uploaded image/video.
- Font can be applied to selected characters.
- Drag to move, side handles change box width, corner handles scale, double-click/double-tap text to edit.
- Selection bounds only appear while the object is selected.
- Only `bg.webm` audio is exported.

## Mobile behavior

- Canvas remains the primary view; properties open as a bottom sheet.
- Touch targets and resize handles are enlarged for fingers.
- The canvas allows normal page scrolling except while directly manipulating the selected object.
- Form controls use mobile-safe sizing to avoid unwanted browser zoom.
- Text selections are preserved when moving between the canvas and typography controls.
- On touch devices, completed renders present a **Save video** action so the browser gets a fresh user gesture for saving/sharing the MP4.
- Safe-area insets are respected on notched/home-indicator devices.

## Run locally

Use a local web server instead of opening `index.html` directly:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## GitHub Pages

1. Upload the project contents to a GitHub repository.
2. Add `bg.webm` and `fg.webm` inside `assets/`.
3. In repository Settings → Pages, deploy from the main branch/root.
4. Open the generated Pages URL in an up-to-date browser.

No server, database, login, or uploaded-media storage is used. User media stays in the browser.


## Mobile controls

- Tap **Text** or **Media** at the top of the canvas.
- Drag the selected object with one finger to move it.
- Pinch with two fingers, or drag the bottom-right handle, to scale.
- Drag the right-side handle to change the text/media box width.
- Text mode: use **Edit text**, **Style**, and **Center** below the timeline.
- Media mode: use **Add/Replace**, **Reset size**, and **Center**.

## Export timing

The exporter writes a constant 30 fps MP4. Native ~30 fps template WebMs are decoded sequentially and mapped one source frame to one output frame, avoiding duplicate frames caused by timestamp rounding. Other frame rates use sequential resampling.


## Optional closing logo layer

Add `assets/fg2.webm` to enable the **Closing logo** checkbox. This WebM is treated as an alpha-enabled overlay above the background, editable text/media, and `fg.webm`. The checkbox is off by default. When enabled it affects both preview and MP4 export.
