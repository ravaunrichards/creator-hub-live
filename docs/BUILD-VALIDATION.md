# Build and Source Validation Report

Validation date: 2026-10-12. Checks were run against the local Release 3.2.6 source package, not the live deployment.

## Passed locally

- `npm run check` — passed.
- `node tests/integration-check.js` — 96 checks passed, 0 failed.
- `node tests/security-audit.js` — 114 source/config files scanned; no matching private credential patterns found.
- `node tests/deployment-payment-check.mjs` — payment chooser, cache, backend release marker and deployment contracts passed.
- `node tests/teams-contract-check.mjs` — Teams/league route and schema contract checks passed.
- `node tests/league-structure-check.mjs` — official 18-division hierarchy contract passed.
- Backend route check — 69 browser routes checked; 19 canonical backend endpoint strings verified.
- Backend syntax — 7/7 backend source files passed.
- LIVE contract tests — all listed authorization/room scenarios passed.
- Team league route tests — active season, no-active-season empty state, and missing-schema diagnostics passed.
- Admin season API tests — authorization, date-window activation, duplicate-active protection and standings initialization passed.
- PayPal environment tests — explicit aliases, unknown-value rejection, case-insensitive keys and blank-key fallback passed.
- `node scripts/sync-web-assets.js` — completed, and the follow-up consolidated check confirmed frontend/bundled-web parity.

## Not established

Local checks do not prove the live Supabase schema/migration state, deployed backend reachability, production CORS, PayPal OAuth/order/capture/webhook behavior, real user authentication, payment reconciliation, LIVE media behavior or responsive rendering on the user's devices. Migration 0017 was not executed against the owner's live database. Verify these in the target environment before calling the project production-ready.
