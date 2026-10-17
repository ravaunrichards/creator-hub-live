# Creator Hub Live Style Switcher — manual installation

This package targets `ravaunrichards/creator-hub-live` branch `main` and contains only the integration files that must be added/replaced. It does not edit GitHub, Supabase, Render, or the deployed site.

## Files
- Replace `frontend/index.html` and `android/app/src/main/assets/web/index.html`.
- Add `frontend/src/style-switcher.js` and `android/app/src/main/assets/web/src/style-switcher.js`.
- Add `frontend/src/style-switcher-integration.js` and `android/app/src/main/assets/web/src/style-switcher-integration.js`.
- Replace `frontend/sw.js` and `android/app/src/main/assets/web/sw.js`.
- Replace `tests/style-switcher-contract.mjs`.

The existing style-switcher CSS tokens are already present in `frontend/styles/app.css`; the existing migration is `database/0038_appearance_preferences.sql`. Neither is duplicated in this package. Do not apply a new migration from this ZIP.

## Validation
Run `node tests/style-switcher-contract.mjs` and `node --check frontend/src/style-switcher.js` plus `node --check frontend/src/style-switcher-integration.js` from the repository root. The contract test checks source wiring, the migration path, CSS structure, 432 static theme/family combinations and website/Android parity. It does not claim a real-browser test. The in-app **Run style relay tests** action checks computed tokens and current viewport overflow; test it on desktop and a narrow Android viewport before release.
