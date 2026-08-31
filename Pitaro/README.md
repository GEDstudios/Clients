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
