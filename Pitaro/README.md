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
- Text starts on frame 10 at +50 px Y and rises to its final position over 10 frames using `cubic-bezier(0, 0.5, 0, 1)`. There is no opacity animation.
- `Word by word` starts each subsequent word 3 frames after the previous word, using the same position animation.
- The existing 2%/second automatic scale remains one uniform transform on the complete editable layer.
- The inspector contains a synchronized rich-text editor, so copy and per-selection fonts can be edited even while the animated preview text is not yet visible.

## GitHub Pages
Upload the project contents to a repository and enable GitHub Pages from the repository root. No build step is required.
