# Creator Hub Creator Network — Coordinated Implementation 3.3.0

**Repository:** `ravaunrichards/creator-hub-live`  
**Branch:** `main`  
**Release type:** complete source-tree replacement for manual installation  
**Prepared:** 2026-10-12

This release continues the existing project. It does not create a new app or push changes to GitHub, Supabase, or a hosting provider. Review, install, migrate, and deploy manually.

## Included implementation

### Teams schema and API

- Adds `database/migrations/0018_teams_schema_convergence.sql` as a forward-only additive convergence migration for the current Teams API contract. It adds missing optional/API columns, preserves existing business values where possible, normalizes unknown competitive division values to D5, preserves existing standings/results, repairs missing enrollment rows for real teams in an already-active season, and maintains enrollment for new teams.
- Retains the read-only diagnostic `database/diagnostics/league_schema_preflight.sql`; it reports missing expected tables/columns instead of presuming the live schema.
- Keeps legacy numeric `teams.level` only for compatibility. The official competitive hierarchy is 18 divisions: A1–A3, B1–B5, C1–C5, D1–D5. New teams default to D5; competitive placement uses `division_code` and season standings.
- Migration `0019_league_operations_and_payouts.sql` checks critical prerequisites and stops if an existing schema requires a manual reconciliation, rather than deleting or synthesizing ambiguous records.
- Migration `0020_wallet_gift_schema_and_security.sql` converges wallet/gift schema fields, serializes concurrent gift retries, repairs ledger idempotency contracts, and restricts sensitive SECURITY DEFINER wallet/gift RPCs to the backend service role. The original `0003` schema definition is also corrected for fresh installations.

### League season and fixture lifecycle

- Authenticated admin API to list/create/activate seasons using administrator-provided names and exact start/end date-times.
- At most one active season; activation must fall within its configured time window.
- Initializes season membership from existing real teams; subsequent team creation enrolls into the active season.
- Admin fixture listing and idempotent missing-fixture generation by round robin within each division, preserving existing fixtures/results.
- Server-side score recording, correction, cancellation of scheduled fixtures, standing recalculation, and guarded season finalization.
- Season finalization is blocked before `ends_at`, while scheduled/live fixtures remain, or where divisions with two or more enrolled teams have no completed result for one or more teams. Finalized divisions apply the configured top-two promotions except A1 and bottom-two relegations except D5, with safeguards against marking a team for both in a small division.
- Public standings and fixtures are served from the active season. A truly missing active season returns an honest empty state; it does not create a season or invent dates.
- The TikTok Creator League tables/API (`creator_leagues` and related tables) remain separate from the 18-division team league. This release does not merge the two data models.

### PayPal environment and creator payouts

- Backend environment parsing normalizes Live/Sandbox aliases and invisible Unicode formatting characters, and the backend release marker reports `3.3.0` for deployment identity checks.
- PayPal remains the only advertised payout method until another provider is actually integrated.
- Creators can save their PayPal payout email under Settings → Payments and submit a payout request from Creator Earnings. Requests use an idempotency key and an atomic server-side diamond debit/withdrawal record.
- Admin payout queue reads the existing `diamond_withdrawals` ledger (not an assumed separate `payouts` table). Admin transitions are checked server-side; rejection refunds diamonds with a unique ledger key.
- The admin screen records the actual fiat amount/currency and PayPal transaction reference. **This release does not call the PayPal Payouts API automatically and does not define a diamond-to-fiat conversion rate.** An authorized administrator must perform a transfer in PayPal and only then record it as paid.

### Website integration and regression coverage

- Creator Teams, league fixtures/results, settings/payment destination, creator earnings, and admin payout pages use the new backend contracts.
- The service-worker/cache release version is `3.3.0`.
- Bundled web assets are synchronized from `frontend/` using `node scripts/sync-web-assets.js`.
- Mocked/unit/contract tests cover Teams/league operations, season administration, PayPal environment parsing, payout authorization/idempotency/status transitions, security-pattern scanning, source structure and bundled-web parity.

## No invented data

No fake users, teams, seasons, dates, fixtures, results, balances, conversion rates, PayPal transfer confirmations, or OAuth credentials are created. The administrator must enter the real season date range. Existing records are preserved; the migration stops when ambiguous duplicate numbered fixtures or unusable saved payout destinations need intentional human review.

## Manual installation order

1. Back up the current repository and the target Supabase database. Preserve private local configuration outside the archive.
2. Extract the ZIP and merge the complete `creator-hub-live-main/` tree into the existing repository working directory. Review any same-name files containing local customizations.
3. Run `database/diagnostics/league_schema_preflight.sql` in the SQL editor for the exact Supabase project/environment the live backend uses. For a wider read-only inventory of tables, columns, constraints, indexes, RLS, grants, functions, triggers and migration history, also run `database/diagnostics/full_supabase_inventory_audit.sql`. Record table/column presence and active-season counts. The inventory script contains SELECT-only queries; it does not write data.
4. Confirm the canonical base tables/columns from migrations `0001`, `0003`, `0004`, `0006`, and `0008` exist; also review `0015` and `0016` for the existing Teams completion and 18-division catalog. `0014_creator_league_server.sql` is a separate Creator League model.
5. Review `0017_team_schema_compatibility_repair.sql`. It is suitable only if its prerequisites—including the existing `teams.points` field used by its index—are present. If those prerequisites do not hold, **do not force 0017**; review its purpose and use the broader convergence migration `0018_teams_schema_convergence.sql` after confirming 0018's own prerequisites. If 0017 is already applied, 0018 is written to converge the same fields idempotently.
6. Apply `0018_teams_schema_convergence.sql` only after its preflight requirements pass. Inspect any migration exception and stop to reconcile the actual schema rather than repeatedly rerunning it.
7. Review and apply `0019_league_operations_and_payouts.sql` only after its league, event, wallet, withdrawal and D5 prerequisites pass. It intentionally stops if numbered fixtures are duplicated or saved payout destinations are unusable; review those existing records manually rather than deleting data.
8. Review and apply `0020_wallet_gift_schema_and_security.sql` after confirming the wallet, both ledger and gift tables. It stops on ambiguous financial data rather than guessing, and should be checked before deploying wallet/gift traffic.
9. After reviewed database changes commit, run `NOTIFY pgrst, 'reload schema';` in the target Supabase SQL editor.
10. From repository root, run `npm run check` and `npm run repair:contracts`. All must pass before publishing.
11. Deploy the Node service from `backend/` and publish the static site from `frontend/` as separate services. Confirm the frontend points to the backend you just deployed.
12. Check `GET /api/health` for `backendRelease: "3.3.0"` and `GET /api/config/public` for a non-invalid `paypalEnvironment`. These are deployment/config indicators, not proof that DB migrations or a transaction succeeded.
13. In a test account, verify Teams list/create/member flow, admin season creation/activation, fixture generation, score/correction/standings, payout email save/request, admin rejection refund, and PayPal checkout with credentials from the matching environment.

## PayPal environment checklist

- Live: `PAYPAL_ENV=live` with the **Live** Client ID and Client Secret from the same PayPal app.
- Sandbox: `PAYPAL_ENV=sandbox` with the matching **Sandbox** Client ID and Client Secret.
- Remove conflicting keys (`PAYPAL_ENV`, `PAYPAL_MODE`, `PAYPAL_ENVIRONMENT`) and restart/redeploy the actual backend service. Do not use a short-lived Postman access token as a secret. Do not place private secrets in `frontend/` or this ZIP.

## Local validation results

On the prepared source tree, `npm run check` passed the integration/structure/security/asset-parity checks and then passed backend route, syntax, LiveKit-contract, Teams/season-admin, PayPal-environment, league-operations, and payout tests. Details are in `docs/FINAL-VALIDATION-REPORT.md`.

These are local and mocked tests. They do **not** prove the live Supabase schema is migrated, PayPal credentials authenticate, a production backend is on release 3.3.0, the host's CORS settings are correct, or actual browser/device rendering/payment transfers work. Those checks can only be completed after you manually install and deploy in the target environment.

## Scope honesty

This deliverable completes the repository-backed Teams/league/payout and payment-environment integration described above. External provider configuration, live database application, actual PayPal transfers, live service deployment, and any future product modules whose implementation/content/API is not present in this repository are not silently represented as completed or verified.
