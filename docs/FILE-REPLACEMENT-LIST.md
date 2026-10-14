# File Replacement List — Corrected Source Package

Replace the matching files in this ZIP in your repository after making a backup. Paths are relative to the repository root. This list is based on a byte-for-byte comparison with the uploaded archive.

## Modified files

- `.gitignore`
- `package.json`
- `backend/.env.example`
- `backend/src/server.js`
- `backend/tests/livekit-contract.js`
- `backend/tests/route-check.js`
- `database/migrations/0003_wallet_payments.sql`
- `database/migrations/0006_seed_config.sql`
- `docs/API.md`
- `docs/BUILD-VALIDATION.md`
- `docs/BUILD_REPORT.md`
- `docs/DEPLOYMENT.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/LIVEKIT_FIX.md`
- `docs/README.md`
- `docs/RELEASES.md`
- `docs/SECURITY.md`
- `docs/SETUP.md`
- `docs/TEST_REPORT.md`
- `docs/final-validation-report.md`
- `docs/project-file-manifest.json`
- `frontend/src/pages-wallet.js`
- `android/app/src/main/assets/web/src/pages-wallet.js`
- `android/app/src/main/assets/web/src/pages-room.js`
- `android/app/src/main/assets/web/styles/app.css`
- `tests/integration-check.js`
- `tests/repair-contract.js`

The Android `pages-room.js` and `styles/app.css` copies were replaced with the canonical frontend copies to resolve the two original parity failures. Review these differences if you had device-specific changes in those two Android-only copies.

## New files

- `database/migrations/0013_wallet_package_contracts.sql`
- `tests/security-audit.js`
- `docs/CHANGELOG-2026-10-10.md`
- `docs/FILE-REPLACEMENT-LIST.md`
- `releases/README.md`

## Files intentionally omitted from the output ZIP

- `android/app/release.keystore` — sensitive signing material; treat the original as exposed.
- `releases/creator-hub-live-release.apk`
- `releases/creator-hub-live-release-alt.apk`

No APK was rebuilt. This is a corrected source package, not a new installable app.

## Before deployment

- Rotate exposed private credentials and configure fresh values in your hosting provider.
- Back up Supabase and verify migration state before applying migrations `0001`–`0013`.
- Confirm the deployed frontend origin and Android WebView origin in `FRONTEND_URL`.
- Run `npm run check`, `npm run backend:test`, and `npm run repair:contracts`.
- Test LIVE, wallet, PayPal sandbox, and Android behavior in real environments.
