# Coordinated Full Source Manifest — Release 3.3.0

This ZIP contains the full source tree for the existing `ravaunrichards/creator-hub-live` repository, not a patch-only bundle or a new project. The main changes are integrated into the original source paths; no GitHub, database, or hosting changes were made remotely.

## Main source changes

- `backend/src/paypal-env.js`, `backend/src/server.js`, `backend/tests/paypal-env.test.js`: PayPal environment normalization, release `3.3.0` marker, route registration and secret-safe public config.
- `backend/src/payout-routes.js`: server-authoritative creator payout requests/history and admin payout queue/status changes using `diamond_withdrawals`, not a non-existent `payouts` table.
- `backend/src/team-leagues.js`: season lifecycle and authenticated admin fixture/results/correction/cancellation/finalization endpoints, active-season standings and fixture reads.
- `backend/src/teams-routes.js`, `frontend/src/pages-teams.js`: current Teams API/schema contract with actionable missing-schema failures; legacy `level` is not competitive placement.
- `frontend/src/pages-admin.js`: season, fixture/result and payout operations for admins.
- `frontend/src/pages-settings.js`: safe creator PayPal destination save flow.
- `frontend/src/pages-creator.js`: creator payout request/history and public active-season fixture/results flow.
- `frontend/src/pages-wallet.js`: existing Buy Coins method-selection stage remains; PayPal is the currently supported provider, and other methods must not appear available until integrated.
- `database/diagnostics/league_schema_preflight.sql`: targeted read-only schema preflight. `database/diagnostics/full_supabase_inventory_audit.sql` preserves the uploaded broad read-only Supabase inventory and covers objects, columns, constraints, indexes, RLS, grants, RPCs, triggers and migration history.
- `database/migrations/0018_teams_schema_convergence.sql`: additive Teams schema convergence and existing-row/active-season enrollment repair.
- `database/migrations/0019_league_operations_and_payouts.sql`: fixture operations, payout account/ledger fields, secure payout RPCs, guarded season finalization and schema-cache notification.
- `database/migrations/0020_wallet_gift_schema_and_security.sql`: forward wallet/gift schema convergence, serialized gift idempotency and server-role-only execution grants for sensitive wallet RPCs.
- `frontend/index.html`, `frontend/config.js`, `frontend/sw.js`, and `android/app/src/main/assets/web/`: release/cache identifier `3.3.0` and synchronized web assets.
- New mock-route tests plus updates to integration, deployment/payment, Teams, league and wallet/gift migration contract checks.
- `docs/RELEASE-3.3.0.md`, `docs/FINAL-VALIDATION-REPORT.md`, install/error-recovery docs: manual installation order and explicit test boundaries.

## Install constraints

No remote database migration or deployment was performed. Run `database/diagnostics/league_schema_preflight.sql` against the target Supabase project first. Review whether 0017 is safe for that schema; apply 0018 only after its prerequisite tables and D5 exist; apply 0019 only after its payout/league/function prerequisites pass; apply 0020 only after its wallet/ledger/gift prerequisites pass. See `docs/RELEASE-3.3.0.md` for the exact guarded sequence and failure cases.

## Validation boundary

The local suite passed after the final frontend-to-bundled-web sync. Local checks do not establish live Supabase migration success, PayPal OAuth/checkout/capture/webhook, production deployment identity beyond a reported marker, or end-user/device behavior. Actual PayPal payouts are recorded after an external transfer; the PayPal Payouts API and an automatic diamonds-to-fiat conversion rate are not implemented by this release.
