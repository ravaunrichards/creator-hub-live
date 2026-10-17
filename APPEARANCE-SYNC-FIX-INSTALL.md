# Creator Hub Live — Appearance Account Sync Fix

## What this fixes

The account sync error `new row for relation "user_settings" violates check constraint "user_settings_appearance_contract"` means the database is rejecting the JSON stored in `user_settings.appearance`. The Style Switcher stores the current appearance as an object with `mode`, `theme`, `typography`, `surfaces`, `density`, `motion`, and `contrast`; older settings clients may use a different object shape. The old constraint is too restrictive for the supported clients.

This package replaces that check with a compatibility-safe database contract: `appearance` can be SQL NULL or a JSON object. Existing object-shaped preferences are preserved; only malformed non-object JSON values are cleared to NULL. The client still normalizes choices to supported values before saving.

## Manual installation

1. Back up the current repository and database migration folder.
2. Copy the files in this ZIP to their matching paths, preserving all unrelated files:
   - `database/migrations/0039_appearance_contract_compatibility.sql`
   - `frontend/src/style-switcher.js`
   - `frontend/sw.js`
   - `android/app/src/main/assets/web/src/style-switcher.js`
   - `android/app/src/main/assets/web/sw.js`
   - `tests/style-switcher-contract.mjs`
3. In the intended Supabase project's SQL Editor, review and run `database/migrations/0039_appearance_contract_compatibility.sql` once. The frontend patch alone cannot change a database constraint.
4. Deploy/install the matching frontend and Android web assets through your normal manual process. The service-worker version is bumped to `chl-web-v3-3-4` so cached clients fetch the corrected scripts.
5. Sign in, open **Settings → Appearance**, select a theme/style, and choose **Apply & save**. Confirm the UI reports that the choice was saved to the account and this device.
6. Reload the app and sign in on another device/browser to verify the preference restores from the account.

## Checks

Run from the repository root:

```sh
node tests/style-switcher-contract.mjs
```

The test checks the migration contract, actionable error handling, style switcher setup, 432 theme/style combinations, and byte-for-byte parity of the relevant web and Android files.

## Important boundary

This is a manual-install package. It does not modify GitHub, run SQL against your live Supabase project, or deploy to Render. Account sync will remain unavailable until the migration is applied to the database used by the app.
