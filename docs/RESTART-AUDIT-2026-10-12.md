# Read-only repair audit — 12 October 2026

## Repository state

Read-only GitHub inspection confirmed the current `main` HEAD is `13f12800349652f5920c3f3ae992c53fc5737afd` (2026-10-12T18:50:48Z). The current tree includes `backend/`, `database/`, `docs/`, `frontend/`, `tests/`, root `package.json`, and the full 0001–0024 migration set. The repository contains the full source; earlier 4.0.1 notes stating that `main` contained only `.gitignore` and `package.json` are historical observations from a prior snapshot and no longer describe the current HEAD.

The local source package used for this update matches current `main` blobs for `package.json`, `frontend/src/pages-admin.js`, `database/migrations/0023_settings_schedules_analytics.sql`, and `backend/src/server.js` before local update changes. This package does not alter GitHub.

## Live database observations — read-only

Connected project: `Creator-Hub-Live` (`txibryhznycmuqufnxvh`), reported active/healthy by Supabase tooling. Migration list is empty and `supabase_migrations.schema_migrations` is not present, so numeric migration history is not available from the database. Schema must be reconciled from actual objects rather than treating migration numbers as reliable install state.

The inspected schema contains current profiles/social/wallet/LIVE/team/league/payout tables, but missing fields and objects required by the current code:

- `profiles.account_status`, `profiles.deactivated_at`.
- Teams contract fields including `teams.description`, `parish`, `recruiting`, `max_members`, `updated_at`, plus `team_members.joined_at`.
- `league_matches.round_number` and creator-payout columns on `diamond_withdrawals`.
- Tables `user_settings`, `live_schedules`, `paypal_payout_info`, `creator_battles`, `creator_missions`, `creator_mission_claims`, `creator_verification_requests`, `public_creator_badges`.
- RPCs for creator metrics/rankings/settings saving, creator payouts, and account lifecycle/battle/mission controls.

Observed non-sensitive counts: 3 profiles, 18 payment rows, 3 wallet rows, 6 active USD coin packages; teams, team members, seasons, matches, standings, diamond withdrawals, coin ledger, diamond ledger, and gift transactions were empty at inspection time. Financial-integrity checks for wallet NULL/negative values and duplicate wallet/idempotency keys returned zero issues. Existing core credit/debit/gift/withdrawal functions were present and their execute privileges were restricted to `service_role`.

## Root-cause assessment

`backend/src/server.js` checks `profiles.account_status` during every authenticated backend request. Because the column is missing in the inspected schema, the API can return `ACCOUNT_STATUS_LOOKUP_FAILED` before it reaches Teams, wallet/PayPal, or payout-specific logic. That is a shared blocker, in addition to each feature's missing schema objects. This does not establish that PayPal OAuth credentials are valid or invalid; Render service credentials/runtime were not inspected in this audit.

## Scope of local update

- Provide a read-only diagnostic query and a dependency-ordered migration plan.
- Add the appearance settings migration after 0024, and implement compact/balanced/spacious plus dark/light/system preferences with local fallback and account sync.
- Replace the generic admin verification list with real RLS-backed grant/revoke Verified Creator badge controls. Existing application review remains under Admin → Community.
- Preserve existing server-side wallet/RPC security; do not create test users, teams, seasons, matches, balances, gift records or payment records.

## Important limits

No Supabase SQL was written or migration applied. No GitHub source file was changed. No Render service settings/deploys/logs were inspected because the Render connection required a workspace selection and none was selected. No PayPal transaction/OAuth call, LiveKit session, browser rendering, physical-device test or production acceptance was run. Apply this package manually only after backup and preflight; then complete `docs/VALIDATION-4.0.2.md`.
