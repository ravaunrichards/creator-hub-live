# Creator Hub Creator Network

This is the existing `ravaunrichards/creator-hub-live` repository. Release 3.3.0 is a coordinated **full source-tree replacement for manual installation**, not a new project and not a remote deployment.

## Source layout

- `frontend/` — canonical static web application, configuration template, assets, route modules, styles and service worker.
- `backend/` — Node.js API service, authentication-aware Teams/league/payout routes, payment and LIVE integrations, environment example, tests.
- `database/migrations/` — ordered SQL migration history, including the forward-only Teams convergence and league/payout workflow migrations.
- `database/diagnostics/` — read-only schema preflight and full Supabase catalog inventory query.
- `scripts/` — repository maintenance scripts, including frontend-to-bundled-asset synchronization.
- `tests/` — source/contract/security checks.
- `docs/` — manual installation, environment, database prerequisites, limitations and validation reports.

## Start here

1. Read `INSTALL.md` from this folder and `START-HERE.txt` at the repository root.
2. Back up the current source and your Supabase database before installation or migrations.
3. Run `database/diagnostics/full_supabase_inventory_audit.sql` to inventory the actual Supabase schema, and run `database/diagnostics/league_schema_preflight.sql` before any league migration. Both are read-only.
4. Review `DATABASE.md` and the preconditions/comments in each migration. Apply only migrations that are not already installed and whose prerequisites match. Do not apply a migration to a different Supabase project by mistake.
5. Configure the backend using `backend/.env.example` as a variable-name reference only. Never copy secrets into browser configuration or documentation.
6. Run the local checks in `FINAL-VALIDATION-REPORT.md`, then install and deploy manually. Complete the live verification checklist after your own target environment is updated.

## Key API areas

- `GET /api/health` and `GET /api/config/public` — release/configuration indicators.
- `/api/teams` — team discovery, details, owner-managed editing, membership.
- `/api/leagues` — active-season fixtures and standings.
- `/api/admin/leagues` — authenticated administrator season, fixture, result and finalization operations.
- `/api/payments/paypal/*` — PayPal checkout/account configuration routes as implemented by the backend.
- `/api/payouts/*` — creator payout request/history and administrator payout review.
- `/api/live/*` and `/api/livekit/*` — LIVE session and token routes.

For the full routes list and specific request behavior, see `API.md` and the route implementations under `backend/src/`.

## League rules

The team competition has 18 divisions: A1–A3, B1–B5, C1–C5 and D1–D5. New teams start in D5. The database-backed competition system—not an editable level 1–50 field—controls division standings, promotions and relegations. The separate Creator League subsystem remains a separate data model.

A missing active season is shown as an empty state until an administrator creates a season with real dates and activates it. The application does not seed fake seasons, teams, fixture results or balances.

## Validation and status

Run from the repository root:

```sh
npm install
npm run check
npm run repair:contracts
```

These repository tests are source-, contract- and mocked-workflow tests. They do not run the SQL migrations against your live Supabase project or prove that PayPal credentials, hosting configuration, CORS, or real-device behavior work. After manual installation, follow `ERROR-RECOVERY-2026-10-12.md` and `FINAL-VALIDATION-REPORT.md` to verify those dependencies.

## Security

Private Supabase service-role credentials, PayPal client secrets, webhook secrets, LiveKit secrets, access tokens and signing keys must remain in the appropriate private environment. A short-lived PayPal OAuth access token is not a substitute for the PayPal client ID and secret; the backend should obtain a token from the configured credentials. Never include real secrets in browser files, source maps, docs or this release ZIP.
