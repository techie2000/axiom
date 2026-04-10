# Branding Assets

This directory stores source branding files used to generate frontend runtime icons and logos.

## Source Files

- `axiom-logo-source.jfif` - primary colour source asset.
- `axiom-logo-alt-bw-source.jfif` - alternate black/white source asset for future theme use.

## Runtime Outputs

Runtime assets are served from `frontend/public/branding`.

- Active (primary):
  - `logo.png`
  - `favicon.ico`
  - `favicon-16x16.png`
  - `favicon-32x32.png`
  - `apple-touch-icon.png`
- Prepared alternate (not active by default):
  - `alt-bw/logo.png`
  - `alt-bw/favicon.ico`
  - `alt-bw/favicon-16x16.png`
  - `alt-bw/favicon-32x32.png`
  - `alt-bw/apple-touch-icon.png`

## Notes

- Keep source files in this directory and generate frontend assets from them.
- Do not point app metadata to `alt-bw/*` unless intentionally switching the active brand theme.
