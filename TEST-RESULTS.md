# Test and Installation Notes

## Verification performed

The available workspace checks completed successfully after the final code changes:

- `npm run check` — passed: integration checks reported **360 passed, 0 failed**; gift asset/WAV contracts passed; payout workflow contract reported **16 checks passed**; platform-upgrade contracts passed.
- `npm run backend:test` — passed: route contract, backend syntax (**3/3**), and LiveKit track/permission contracts passed.
- `npm run repair:contracts` — passed: LiveKit start gate, source restrictions, database state/update timestamp contract, Android source parity, stored settings, chat, wallet and gift contracts.
- `node --check` passed for edited JavaScript modules and the new contract test.
- The ZIP itself is checked with `unzip -t`, and Android replacements are checked against their frontend counterparts.

**Important limitation:** no connected Supabase, LiveKit or PayPal credentials were used; no production service was contacted for test writes, and no migration was executed. These are local syntax/static/contract checks, not proof of provider-connected end-to-end behavior. The editable source files were checked against the latest `main` baseline before editing, but the locally available test workspace is an older extracted snapshot missing some unchanged auxiliary files from that commit. In particular, the existing `backend/src/teams-routes.js` dependency must be present when the bundle is overlaid onto latest `main`.

## Before uploading

1. Make a backup/commit of the latest `main` working tree.
2. Extract this ZIP at the repository root, preserving the destination paths. Do not upload the ZIP contents into a nested `creator-hub-live/creator-hub-live` directory.
3. Keep your real deployment secrets in private deployment environment settings. `backend/.env.example` is deliberately a placeholder-only template; it is not the active `.env` file.
4. Review `database/migrations/0028_live_modes_appearance.sql`, confirm the existing migration state/schema and take a database backup/snapshot. Apply the migration once through your normal migration workflow or Supabase SQL Editor only after reviewing prerequisites. It changes the guest-status CHECK constraint and adds account appearance/media-mode/audience fields; it does not delete sessions, gifts, wallets, or transactions.
5. Confirm `backend/src/teams-routes.js` exists in the latest `main`, install backend dependencies using the repo's normal process, and deploy/restart the backend before testing routes that depend on it.
6. Check the coin table configuration: custom quantities use exact active package prices when present; otherwise they use the server-configured active **1,000-coin USD reference package**. If that reference/package schema is not correctly configured, the endpoint returns an error rather than inventing a price. PayPal sandbox should be used for initial checkout testing.

## Suggested first test pass

1. Create and join each LIVE type: Video LIVE, Audio-Only LIVE, and Screen-Sharing LIVE. Verify microphone/camera permission prompts match the selected mode. Also verify the existing Share Screen button still works inside a Video LIVE.
2. Test public, followers-only and private LIVE access as the host, an accepted follower, an unrelated account, and a blocked account. Test guest invitations separately.
3. Open the Teams page and test list/detail/join/leave/edit/remove paths with authorized accounts.
4. Change theme, layout, font, text size and accent; navigate to Settings, save privacy/notification preferences, reload and verify appearance is preserved.
5. Test custom coin quotes and checkout in PayPal sandbox; verify the price shown is a backend quote and that coins appear only after confirmed capture.
6. Complete signup/login, profile views, follower lists, Creator Analytics, and share/copy LIVE links.
7. Run `npm run check`, `npm run backend:test`, and `npm run repair:contracts` in the updated repository and report the exact failing output for any problems.

## Security note

The public source history had non-placeholder-looking private backend credential values in an example environment file. This bundle replaces the template values but cannot revoke any credential. Rotate the Supabase service-role key, LiveKit API secret and PayPal client secret from their providers if those actual values were ever valid, update the private deployment environment, and never put the replacements in browser files or the repository.

## Scope note

This is a coordinated test bundle for the inspected and verified blockers in this pass, not a claim that every item in the 46-point wishlist has been fully validated against live services. Existing feeds, profile/privacy pages, team CRUD and gift catalogue are preserved where not listed as replacements; the real account/provider environment is needed to finish acceptance testing. The gift catalogue, artwork, animations and sounds are deliberately not touched.
