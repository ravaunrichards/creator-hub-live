# Error recovery — Release 3.3.0

This release is designed to address the currently reported errors, but only after the source is manually installed, the appropriate SQL migrations are reviewed/applied, and the backend is deployed. No live environment was changed during preparation.

## A. `column teams.description does not exist` / `TEAMS_LOOKUP_FAILED` / HTTP 503 / SQLSTATE `42703`

PostgreSQL `42703` means a column referenced by a query is missing. Run `database/diagnostics/league_schema_preflight.sql` against the same Supabase project the live backend points to. It now checks `teams.description` along with the rest of the Teams/league contract. Review migrations 0004/0008/0015/0016 and whether 0017 was applied. Do not force 0017 if the prerequisites are missing; it creates an index using `teams.points`. The broader `0018_teams_schema_convergence.sql` adds `points` and missing API fields, but still requires the core team/season tables and D5 division. Review its exception and stop if those prerequisites are absent. After a successful database change, execute `NOTIFY pgrst, 'reload schema';`.

If the error persists after that, capture the new exact table/column/database code and compare it with preflight output. Do not repeatedly rerun migrations.

## B. No active league / no active season

The division catalog is not a season. The standings/fixtures endpoint reads a season whose `status='active'`. An empty active-season result is now treated honestly and does not create fake season data. An authorized administrator opens Admin → Leagues, enters the official season name and intended start/end date-times, creates it, and activates it only during that configured time window. The database allows one active season; if one is already active, resolve it first. This implementation does not invent start/end dates. Once active, real existing teams have standings initialized and later-created teams are enrolled automatically. Admins then generate missing fixtures, enter/correct actual scores, and finalize only after season end with no unfinished fixtures and sufficient results. Promotion/relegation is server-authoritative.

## C. `Invalid PayPal environment setting "live"`

The source parser normalizes common Live/Sandbox labels, aliases, whitespace, quotes and invisible Unicode characters. A deployed instance that still rejects literal `live` is likely running older backend code, reading conflicting environment keys, or connecting to a different backend/database configuration. Deploy/restart `backend/`, then check `GET /api/health` for `backendRelease: "3.3.0"`. Check `GET /api/config/public` for `paypalEnvironment`.

- Live credentials: `PAYPAL_ENV=live` plus the Live Client ID and Live Client Secret from the same PayPal app.
- Sandbox credentials: `PAYPAL_ENV=sandbox` plus the matching Sandbox Client ID and Secret.
- Remove conflicting `PAYPAL_ENV`, `PAYPAL_MODE`, `PAYPAL_ENVIRONMENT` values. Never use a short-lived Postman OAuth access token as a client secret.
- A correct release marker shows which source version responded; it does not prove that credentials authenticate or PayPal transactions succeed.

## D. Creator payout errors

The admin screen reads existing `diamond_withdrawals`, not a separate `payouts` table. Migration 0019 must exist in the connected database for payout account storage and RPCs. A creator first saves their PayPal email in Settings → Payments, then submits a payout request with a unique idempotency key. The backend debits diamonds and records the request atomically. Rejecting a request returns the diamonds through an idempotent ledger entry. To mark paid, an authorized admin must perform the actual PayPal transfer externally and enter the real amount, currency and transaction reference. The release does not call the PayPal Payouts API automatically or set a diamonds-to-fiat rate.

## Install and validation order

Follow `docs/RELEASE-3.3.0.md`. Run `npm run check` and `npm run repair:contracts` locally, deploy backend and frontend separately, then verify real authenticated database and provider behavior. Local source tests do not establish live database migration state, PayPal OAuth/capture/webhooks, host CORS, or responsive rendering on actual devices.
