# Build and Source Validation Report

Validation was run locally against this packaged source tree on 2026-10-12. These are source-level results, not proof of production service behavior.

## Passed checks

- `node tests/integration-check.js` — 90 checks passed, 0 failed.
- `node tests/security-audit.js` — 101 source/config files scanned; no matching private credential patterns found.
- `node tests/teams-contract-check.mjs` — passed.
- `node tests/league-structure-check.mjs` — passed.
- `npm run backend:check` — passed, including route checks and source scans.
- `npm run backend:test` — passed, including syntax and LiveKit contract checks.
- `npm run repair:contracts` — passed, including frontend/web asset parity checks.
- `npm run sync:android-web` — passed.

## Not established by these checks

These checks do not prove live Supabase schema/migration state, deployed API reachability, PayPal OAuth/order/webhook behavior, actual LIVE streaming, end-user authentication, payment reconciliation, or responsive rendering on physical devices. Perform those manual checks after installing and configuring the package.
