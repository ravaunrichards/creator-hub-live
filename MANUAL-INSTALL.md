# Creator Hub Live — manual changed-files update

This ZIP contains only repository-relative files that are new or changed for this update. It is **not** a replacement website archive. Keep every path in the ZIP and merge/overwrite only those exact files in the existing `ravaunrichards/creator-hub-live` repository. Do not replace whole folders, delete unrelated files, or upload build output. No GitHub, Render, deployed-site, or live Supabase changes were made by this work.

## Install safely

1. Back up the repository and database first. Keep a copy of the current release so you can roll back.
2. Extract the ZIP and upload each file to the matching repository path, preserving the folder structure. Overwrite matching files; add new files where their paths do not yet exist.
3. **Before deploying the new backend**, apply `database/migrations/0039_wallet_team_integrity.sql` using the project's established Supabase migration workflow. It is a forward-only repair migration and does not reset balances or historical transactions. The migration also reasserts the corrected `comments_del` policy for installations that recorded an earlier version of migration `0038`.
4. If migrations `0036`, `0037`, and `0038` have not been applied yet, apply them in numerical order before `0039`, using the project's normal migration-history process. If they are already recorded as applied, do not manually rerun them; apply only the pending `0039` migration. Do not reset the database or replay seed migrations against production.
5. Configure the backend environment from the real deployment values. Ensure `PAYPAL_ENV` matches the type of PayPal app credentials (`sandbox` with sandbox credentials; `live` with live credentials), and set `FRONTEND_URL` or `PAYPAL_RETURN_URL` to your real HTTPS frontend origin. Never copy example credentials or placeholder values into production.
6. Wallet exchange stays **disabled** until the business has approved both rates and the actual integer values have been set for `CHL_COINS_PER_DIAMOND` and `CHL_DIAMONDS_PER_COIN` in the backend environment. Do not use the explanatory `SET_APPROVED_...` strings as values. Restart/redeploy the backend after environment changes.
7. Deploy using your existing manual/release process, then run the repository checks from the project root and verify the installed website/Android build. Do not assume the migration or PayPal works live until those actual environment checks pass.

## What this delta addresses

- Backend route registration and a new teams/league route module. Team discovery/detail use the backend; team creation, joining, and leaving now call authenticated routes rather than showing fake success messages. Member details and usable validation/error states are included.
- Wallet schema contracts for lifetime gift counts, transaction idempotency, conversion ledgers, PayPal payout info, and diamond payout requests; protected server-side conversion/payout RPCs; corrected comment-delete policy. Payment settings can save or remove the payout email, and submitted requests keep their original email snapshot.
- PayPal return URL normalization and validation, clearer environment mismatch diagnostics, idempotency conflict handling, and capture validation against the expected payment amount and currency before coins can be credited. CORS preflight permits the PATCH/DELETE methods used by existing message, payout, and account workflows.
- Wallet payment-method selection, verified return handling and balance refresh, responsive team UI improvements, and synced Android WebView copies.
- Updated cross-layer contract tests and service-worker cache version.

## Verification performed locally

- `npm run check`: **360 passed, 0 failed** at the integration-check stage; gift asset, social profile/messaging/tasks, social-action/delete, wallet/team/PayPal contract tests also passed.
- `npm run backend:check`: **73 browser routes registered, 69 checked**; 296 frontend files scanned without forbidden private credential patterns; 25 canonical backend endpoint strings verified.
- `npm run backend:test`: backend route checks, syntax checks, and LiveKit authorization/track-contract checks passed.
- JavaScript syntax checks passed for the edited server, team route module, frontend wallet/team pages and Android counterparts. Frontend/Android packaged web assets are checked for byte-for-byte parity (296 files).
- ZIP contents are a delta against the provided local project snapshot; ZIP integrity was checked before delivery.

These are repository-local checks, not proof that production integrations work. Installing the backend dependencies timed out in this environment, so a full server import/startup check could not be completed. The SQL migration was reviewed but could not be executed against a PostgreSQL/Supabase instance here. No live PayPal, Supabase, Render, multi-device Android WebView or production transaction flow was run, and no live services were changed. After installation, verify the actual database schema/migration status, PayPal environment and redirect/capture path, team create/join/leave flows, cash-out request states, and responsive UI on real target devices.

## Financial behavior and limits

- PayPal remains the only payment provider enabled by this code. Coins are credited only after a successful provider capture whose amount and currency match the stored order.
- Exchange ratios are a business rule, not inferred from gift prices. Until both approved exchange-rate environment values exist, conversion returns a clear unavailable response and does not change balances.
- Diamond cash-out requests reserve diamonds in the database. An authorized administrator must confirm the fiat amount/currency; the actual PayPal payout must then be sent through the approved payout process and recorded with its PayPal reference. This update does not claim to automatically issue a PayPal Payouts transfer.
- If `wallets.user_id` contains duplicate rows from a nonstandard legacy database, the unique index creation will fail rather than choose or merge financial balances. Resolve duplicates through a backed-up, auditable reconciliation before retrying the migration.
