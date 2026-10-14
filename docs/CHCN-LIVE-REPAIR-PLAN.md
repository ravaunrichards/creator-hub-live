# Creator Hub Creator Network — live schema reconciliation and update plan

## Boundary and current status

This update is prepared for manual installation in the existing `ravaunrichards/creator-hub-live` project. Do not create a replacement project. Do not treat files in this ZIP as applied to production. No database, GitHub, hosting, or payment-provider changes were made while producing it.

The live schema audit found partial migration state and no readable migration-history table. The shared backend failure is that `requireSupabaseUser()` queries `profiles.account_status`, which is missing. This affects more than one screen, including wallet/PayPal and league/team API requests. Other feature errors match missing table/column/RPC dependencies listed in `docs/RESTART-AUDIT-2026-10-12.md`.

## Read-only preflight first

1. Take and verify a recoverable Supabase backup.
2. Run `database/diagnostics/chcn_live_repair_preflight.sql` read-only and save the result.
3. Confirm the database still has `profiles`, `teams`, `team_members`, `leagues` including D5, `league_seasons`, `league_standings`, `league_matches`, `league_events`, `wallets`, `coin_ledger`, `diamond_ledger`, `diamond_withdrawals`, `gifts`, `gift_transactions`, and the social/LIVE/report tables named in the diagnostic.
4. Stop if any prerequisite is missing, if financial-integrity checks report any issue, or if the database differs materially from the audited snapshot. Do not use `IF NOT EXISTS` as proof that an older migration is safe.
5. Supabase reports no migration list entries, and the standard `supabase_migrations.schema_migrations` table was not found. Therefore the install operator must compare actual objects and migration contents instead of blindly running all files by number.

## Recommended selected reconciliation order

Apply each file manually only after reading the whole migration, taking a backup, checking prerequisites and understanding every data-changing statement. Run one at a time, stop on any error, then re-run the read-only diagnostic and inspect PostgREST schema visibility.

1. `database/migrations/0015_teams_backend_complete.sql` — fills missing Teams contract columns and server-only create/join/update RPCs. Its owner membership backfill only mirrors real existing team owners; audited `teams` count was zero.
2. `database/migrations/0018_teams_schema_convergence.sql` — converges the Teams/standing schema. It contains normalization/backfill statements for legacy values, so review them even though audited teams and standings were empty.
3. `database/migrations/0019_league_operations_and_payouts.sql` — adds `round_number`, payout-ledger columns, saved PayPal destination and server-only creator payout RPCs. Audit found `diamond_withdrawals` empty and `paypal_payout_info` absent; recheck before applying.
4. `database/migrations/0021_social_academy_conversations.sql` — creates `user_settings` and secure conversation/account-owned progress support. User settings is a prerequisite for later preference/account migrations.
5. `database/migrations/0023_settings_schedules_analytics.sql` — creates the settings-save function, LIVE schedules and metric/ranking functions.
6. `database/migrations/0024_creator_community_account_controls.sql` — adds lifecycle controls, community missions/battles, verification tables and gift rankings; requires user_settings and the metrics/schedule notification helpers above.
7. `database/migrations/0025_appearance_preferences.sql` — adds validated account-synced appearance choices to user_settings.

`0016` catalog appears present enough to satisfy D5 preflight (18 division rows and D5 observed). `0017` convergence work is substantially covered by `0018`, but review both source files if preflight finds additional shape differences. Migration `0020` is not part of the default sequence because read-only checks found its wallet financial-integrity conditions clean and the core RPCs already restricted to `service_role`; review and run it only if security/catalog checks now show missing requirements. Do not replay 0001–0014 just because they have lower numbers; the base objects already exist and migration history is absent.

## Application/frontend update

- Copy the changed website source from this package: `frontend/src/pages-settings.js`, `frontend/src/pages-admin.js`, `frontend/styles/app.css`, `frontend/index.html`, `frontend/config.js`, `frontend/config.example.js`, `frontend/sw.js`.
- Keep Supabase publishable config and existing endpoints aligned to the current intended deployment. Do not expose service-role credentials, PayPal client secrets or short-lived tokens in browser files.
- Deploy the matching backend source from the existing project when ready. Rebuild the hosting deployment using the user's manual workflow; the ZIP does not deploy anything by itself.
- Clear/update static/service-worker caches by deploying the bumped 4.0.2 cache-busting values together.

## PayPal status: repair path vs verification

The current Buy Coins UI opens method selection and PayPal is the only implemented checkout provider. Backend logic uses the server package catalog, creates/captures orders, and credits via the service-role `credit_coins` RPC with idempotency. Save-Withdrawal uses `paypal_payout_info`. The missing lifecycle column can block both before their specific routes run; `0019` restores destination and payout schema, `0024` restores lifecycle gating.

This audit did not inspect Render credentials or make a live PayPal call. After migration/deploy, verify that backend variables are correctly paired for the desired environment: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` (or supported aliases), and `PAYPAL_RETURN_URL`. Do not add an OAuth bearer/access token from Postman; those are temporary tokens, not the client credentials. Test purchase flow end-to-end in the chosen environment only when ready and verify exactly one server-confirmed wallet credit for each successful captured order.

Creator payout requests currently reserve diamonds and are processed by admin after a transfer is done externally in PayPal. The current module does **not** automatically call PayPal Payouts API. Automated payout was selected as a desired feature but is a separate follow-on integration requiring verified PayPal product permissions and careful transaction/reconciliation testing; this package does not claim it is implemented. No new paid provider is introduced by this update.

## Selected features and what this update does not pretend to finish

This repair focuses on current failures, appearance choices, and working manual verification-badge management. It preserves existing social, LIVE, wallet and league code. Audio-only LIVE, advanced video editing/effects, AI recommendations, subscription payment settlement, playlists, and other selected enhancements require a separate implementation and acceptance phase; a selection is not evidence that the function already exists. Keep paid/provider-dependent additions off until actual credentials/costs and tests are available.

## Acceptance gates

Use `docs/VALIDATION-4.0.2.md` and `docs/PRODUCTION-ACCEPTANCE-CHECKLIST.md`. In particular confirm account lifecycle schema; Teams CRUD; rankings/metrics; settings persistence; badge grant/revoke; PayPal info save/load; order create, capture and idempotent credit; payout reservation/refund/admin status; mobile layout/theme preferences; and all safety/authorization rules. Mark provider/production checks as not tested until actually executed.
