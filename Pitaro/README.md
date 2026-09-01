# Toolbox Composer

Static GitHub Pages video compositor.

## Required assets
Place these files in `assets/`:

- `bg.webm`
- `fg.webm`
- `fg2.webm` — closing logo overlay
- `pitaro-symbol.svg` — page logo

The bundled fonts are already under `assets/fonts/`.

## Current behavior

- 1080 × 1920 composition, 30 fps MP4 export.
- Composition duration is the longest of `bg.webm`, `fg.webm`, and `fg2.webm`.
- Layer order: background → editable text/media → foreground → optional closing logo.
- Closing logo is enabled by default.
- Preview autoplays muted when required by browser policy and loops by default; the first user gesture restores background preview audio.
- Export audio comes only from `bg.webm`.
- Text starts on frame 10 at +20 px Y and rises to its final position over 10 frames using `cubic-bezier(0, 1, 0, 1)`. There is no opacity animation.
- `Word by word` is enabled by default. Each subsequent word starts 2 frames after the previous word, using the same position animation.
- The existing 2%/second automatic scale remains one uniform transform on the complete editable layer.
- The inspector contains a synchronized rich-text editor, so copy and per-selection fonts can be edited even while the animated preview text is not yet visible.

## GitHub Pages
Upload the project contents to a repository and enable GitHub Pages from the repository root. No build step is required.

## v18.5 synchronized preview / scrub / mobile export
- Text motion in preview is snapped to the same exact 30 fps frame grid used by MP4 export, so entrance and global scale positions match output frames.
- The playhead is frame-snapped to 1/30 s. While scrubbing, the UI keeps a synchronized composite visible and only updates it after all active video layers have landed on the same requested time.
- Export no longer assumes one decoded input frame equals one output frame. Each 30 fps output frame is selected from the source videos using their real presentation timestamps through monotonic `canvasesAtTimestamps` decoding.
- Source videos can therefore be 29.97, 30, 60, or variable-frame-rate without corrupting the output cadence.
- Mobile AVC output remains 1080×1920 at fixed 30 fps, but uses a mobile-decodable ~18 Mbps VBR quality target and High Profile Level 4.0 only when supported. Encoder latency mode remains `quality` (no intentional frame dropping).


## v18.6 mobile export stability

The HQ export path now uses bounded CanvasSink pools, sequential presentation-order decoding, serialized template-layer decoding, audio-first encoding, and a mobile-friendly H.264 Main@4.0 preference. These changes are specifically intended to avoid mobile GPU/codec memory pressure and cadence corruption while preserving 1080x1920 30 fps output.


## v18.7 mobile compatibility export

On mobile, export now prefers software decoding and software H.264 encoding, uses a low-complexity AVC profile, and forces every output frame to be a key frame. This is intentionally slower and creates a larger file, but removes inter-frame dependencies and avoids buggy mobile hardware AVC paths. Output remains 1080×1920, 30 fps MP4.

Text entrance position easing is `cubic-bezier(0,0,0,1)`.


### Mobile preview optimization
- Mobile playback uses soft playback-rate correction for secondary layers instead of repeatedly hard-seeking decoders.
- Preview UI/text updates are limited to the 30 fps composition frame grid.
- While dragging the playhead on mobile, video seeks are throttled for responsiveness; an exact multi-layer seek is performed on release.
- The mobile-safe software export path from v18.7 is unchanged.


## v18.9 preview updates

- Word-by-word stagger is 2 frames.
- Mobile playhead scrubbing now shows a lightweight live composite while dragging; release performs the exact synchronized seek.
- Mobile export remains unchanged from v18.8.
