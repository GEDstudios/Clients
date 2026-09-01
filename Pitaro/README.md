# Toolbox Composer

Static GitHub Pages video composer.

## Required assets
Place these files in `assets/`:

- `bg.webm`
- `fg.webm` — transparent foreground
- `fg2.webm` — transparent closing-logo overlay
- `pitaro-symbol.svg` — page/header symbol

Fonts are included under `assets/fonts/`.

The composition duration is the longest of `bg.webm`, `fg.webm`, and `fg2.webm`. Export audio comes only from `bg.webm`. `Closing logo` is enabled by default.

## Text motion

- Preview autoplays and loops by default.
- Text is hidden for the first 10 frames.
- On frame 10 the full sentence becomes visible at the exact same moment its movement starts, 50 px below its final position.
- It rises into place over 10 frames with `cubic-bezier(0,0.5,0,1)`.
- There is no entrance opacity animation.
- `Word by word` staggers each word by 3 frames while keeping the same position animation.
- The existing automatic scale animation remains one uniform transform for the complete text layer.

The text can also be edited from the Typography panel using the dedicated text field, including while the animated text is currently hidden in the preview.

## Mobile text styling
Tap **Edit text**, select characters, and use the floating typography toolbar above the keyboard. Font changes and size steps preserve the selection; **More** opens the full typography panel.

## Deploy
Upload the folder contents to a GitHub repository and enable GitHub Pages for the repository root.
