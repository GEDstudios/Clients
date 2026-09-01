# Toolbox Composer

Static GitHub Pages video composer.

## Required assets
Place these files in `assets/`:

- `bg.webm`
- `fg.webm` — transparent foreground
- `fg2.webm` — transparent closing-logo overlay

Fonts are already included under `assets/fonts/`.

The composition duration is automatically set to the longest of `bg.webm`, `fg.webm`, and `fg2.webm`. Audio comes only from `bg.webm`.

`Closing logo` is enabled by default and can be toggled from the editor controls.

## Deploy
Upload the folder contents to a GitHub repository and enable GitHub Pages for the repository root.


## Branding

Place the supplied Pitaro symbol at `assets/pitaro-symbol.svg`. The page uses it as the header logo and favicon.

## Mobile text styling
Tap **Edit text**, then select a word or characters. A floating typography bar appears beside the selection and stays inside the visible area above the on-screen keyboard. Font changes and size steps preserve the selected text. **More** opens the full typography panel for spacing, alignment and text-box width.


## Mobile text selection

When text is selected on mobile, the floating typography toolbar automatically moves to the opposite edge of the visible viewport from the selection. This prevents Android/iOS native selection menus from covering the app controls and keeps the selected text visible.
