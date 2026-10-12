# Coordinated Source Change Manifest

This is a full source ZIP for the existing `ravaunrichards/creator-hub-live` project, not a patch bundle. Back up your existing working tree and preserve your local environment variables before merging.

## Main corrections in this package

- `backend/src/team-leagues.js` (new) and `backend/src/server.js` — connect the existing `/api/leagues/standings` UI request to the server, returning real active-season standings, an honest empty state, or an actionable missing-schema error.
- `frontend/src/pages-creator.js` — remove the obsolete Teams placeholder route that was superseded by the full Teams page.
- `backend/tests/route-check.js` — load the actual `frontend/src/pages-teams.js` module in the route harness and check the new backend endpoint.
- `backend/tests/team-leagues.test.js` (new) — test active season, no active season, and missing table/schema-cache errors.
- `tests/teams-contract-check.mjs`, `tests/deployment-payment-check.mjs`, `tests/integration-check.js`, `package.json` — make the checks cover the actual Teams route, team-league endpoint, and deployment asset cache version.
- `frontend/index.html`, `frontend/sw.js`, `frontend/config.js` — version the app assets and bump the service-worker cache version to 3.2.3 to reduce stale-code/layout deployment issues.
- `android/app/src/main/assets/web/` — synchronized copy of the frontend web tree.
- `docs/INSTALL.md`, `docs/API.md`, `docs/DEPLOYMENT.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/AUDIT_FINDINGS.md`, `docs/RECOVERY-FIXES.md`, `docs/MASTER-INSTALLATION.md`, and this manifest — corrected installation order and honest verification boundaries.

## Database and provider boundaries

No database migration was executed. If the preflight confirms `public.league_seasons` is absent, the existing migration `0008_server_authoritative_leagues.sql` must be reviewed and applied by the project owner; refresh PostgREST's schema cache afterward. PayPal live OAuth requires `PAYPAL_ENV=live` and a matching live Client ID/Secret on the backend. A Postman access token is not a permanent backend credential.

## Validation boundary

`npm run check` passes in the local source environment. These checks do not prove the production Supabase schema, live PayPal credentials, deployed backend reachability, or actual mobile-browser rendering. Those require verification in the owner's environment.

## Latest coordinated error recovery (2026-10-12)

- `backend/src/paypal-env.js`, `backend/src/server.js`, `backend/tests/paypal-env.test.js` — normalize blank/whitespace PayPal settings safely, accept explicit `live` / `production` / `prod` and `sandbox` / `test` / `testing` aliases, and reject unknown explicit values.
- `backend/src/teams-routes.js` — return specific setup guidance for missing Teams tables and team creation function.
- `frontend/src/pages-teams.js`, `frontend/src/pages-creator.js` — show actual API message, error code, and HTTP status for Teams/league failures instead of hiding the underlying reason.
- `frontend/index.html`, `frontend/sw.js`, `frontend/config.js`, `android/app/src/main/assets/web/` — bump web cache/version to 3.2.3 and synchronize web assets.
- `docs/ERROR-RECOVERY-2026-10-12.md`, `START-HERE.txt` — concise manual deployment order and live-service verification boundaries.
