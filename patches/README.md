# Patch register

## Included replacement: `frontend/index.iphone.html`

This replacement changes only the iPhone web entry's visible product identity from Creator Hub Creator Network to Creator Hub Live, and adds a semantic `role="status"` to its loading indicator. Existing script/style entry points, LiveKit, Supabase, and service-worker wiring are preserved.

## Additive files

- `frontend/assets/chl-icons/*.svg`: new interface icon set; no existing icon is removed.
- `scripts/audit-chl-assets.mjs`: static SVG/GLB checks.
- `scripts/sync-web-assets-safe.mjs`: Android web asset check/sync; never deletes destination-only files.
- `tests/device-readiness-contract.mjs`: iPhone/PWA/Android source contract.
- `verification/device-release-matrix.md`: manual and release evidence checklist.

No gift models, gift catalogue, wallet/payment logic, backend routes, database migrations, secrets, or live deployment configuration are modified.
