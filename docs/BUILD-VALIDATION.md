# Build and Source Validation Report

Validation date: 2026-10-12. Checks were run against this local package. These are source-level results, not proof of production service behavior.

## Passed locally

- `npm run check` — passed.
- `node tests/integration-check.js` — 92 checks passed, 0 failed, including source structure and frontend/bundled-web parity.
- `node tests/security-audit.js` — 108 source/config files scanned; no matching private credential patterns found.
- `node tests/deployment-payment-check.mjs` — cache, payment UI and backend route contracts passed.
- `node tests/teams-contract-check.mjs` — passed.
- `node tests/league-structure-check.mjs` — passed.
- `backend/tests/route-check.js` — 69 routes checked; 19 canonical backend endpoint strings checked.
- `backend/tests/backend-syntax.js` — 6/6 backend source files passed syntax checks.
- `backend/tests/livekit-contract.js` — all 12 listed LIVE authorization/room contract cases passed.
- `backend/tests/team-leagues.test.js` — active season, no-active-season empty state, and missing-schema diagnostics passed.

## Not established

These checks do not prove the live Supabase schema/migration state, deployed backend reachability, production CORS, PayPal OAuth/order/capture/webhook behavior, end-user authentication, payment reconciliation, LIVE media behavior, or responsive rendering in a real browser on the user's devices. Verify these in the target environment before calling the project production-ready.
