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

The Typography panel contains a true rich-text editor using the same Ezer/Gestura font runs and text styling as the composition. Select characters or words there and use the same font controls; changes update the canvas and export model in real time, including while frames 0–9 are hidden.

## Mobile text styling
Tap **Edit text**, select characters, and use the floating typography toolbar above the keyboard. Font changes and size steps preserve the selection; **More** opens the full typography panel.

## Deploy
Upload the folder contents to a GitHub repository and enable GitHub Pages for the repository root.


## Loading
The required background/foreground metadata enables the editor first. The optional `fg2.webm` metadata loads in parallel and no longer blocks the main UI. Template videos use metadata-first preload to reduce initial startup work.
