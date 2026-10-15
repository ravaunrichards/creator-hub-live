# CHL package reconciliation report

This offline package was corrected to consistently identify itself as Creator Hub Live. Runtime branding fallback now uses Creator Hub Live; the service-worker cache was bumped to `chl-web-v3-3-0` so updated assets are not stuck behind the previous cache; the restored multi-guest icon is included in the precache shell; and changed web runtime files were mirrored to Android's bundled web source.

## Important source boundary

The currently connected GitHub `main` was inspected and identifies itself as Creator Hub Creator Network, with a manifest describing it as a continuation of `creator-hub-live`. CHL and CHCN are separate projects per project requirements. Therefore this package was **not blindly merged with that branch** and this report does not claim GitHub-main reconciliation. Do not overwrite a live checkout until the correct CHL source branch is confirmed. No GitHub, Supabase, or Render writes were performed.

## Asset parity

- `assets/gifts/art`: 90 web files; missing Android copies: 0; different contents: 0.
- `assets/gifts/animations`: 90 web files; missing Android copies: 0; different contents: 0.
- `assets/gifts/sounds`: 90 web files; missing Android copies: 0; different contents: 0.
- `assets/gifts/badges`: 6 web files; missing Android copies: 0; different contents: 0.
- `assets/gifts`: 1 web files; missing Android copies: 0; different contents: 0.
