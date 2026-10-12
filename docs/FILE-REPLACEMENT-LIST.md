# Coordinated Source Change Manifest — Release 3.2.6

This is a complete source ZIP for the existing `ravaunrichards/creator-hub-live` project on `main`, not a patch-only bundle or a new project. Back up the current working tree and database before installation. Preserve private environment values and credentials separately.

## Coordinated changes in this release

- `frontend/src/pages-wallet.js` — restores the Buy Coins “Choose payment method” step. PayPal is currently the only integrated checkout provider; other methods are not represented as available until they are implemented.
- `backend/src/paypal-env.js`, `backend/src/server.js`, and `backend/tests/paypal-env.test.js` — normalize common PayPal Live/Sandbox labels, read environment-variable names case-insensitively, and expose a non-secret backend release marker through health/public configuration endpoints.
- `backend/src/teams-routes.js` and `frontend/src/pages-teams.js` — stop requesting the legacy numeric `level` field for team listing and surface database error details for actionable schema diagnosis.
- `database/diagnostics/league_schema_preflight.sql` — read-only check of the tables and columns used by Teams and league standings.
- `database/migrations/0017_team_schema_compatibility_repair.sql` — reviewed additive repair for missing Teams/member columns, legacy/invalid division-code fallback to D5, missing standings for teams in an already-active season, and automatic standings enrollment for newly inserted teams. It does not create teams or seasons.
- `backend/src/team-leagues.js`, `backend/tests/team-season-admin.test.js`, and `frontend/src/pages-admin.js` — authenticated admin API/UI to create seasons with owner-entered dates, activate seasons only within their date window, prevent a second active season, and initialize standings for existing teams.
- `frontend/src/pages-creator.js` — differentiates no active season from an active season with no teams enrolled.
- `frontend/index.html`, `frontend/sw.js`, `frontend/config.js`, and `android/app/src/main/assets/web/` — bump the web cache/version to 3.2.6 and keep bundled web assets synchronized.
- Contract tests and docs are updated to cover the new flows and validation limits.

## Manual installation and database boundary

No database migration or remote deployment was executed while preparing this package. First run `database/diagnostics/league_schema_preflight.sql`, confirm the existing migrations 0004, 0008, 0015, and 0016 are present as appropriate, review 0017 against the live schema, then apply it manually only when its prerequisites are confirmed. Deploy the frontend and backend separately. The backend health response must report `backendRelease: "3.2.6"` after the new backend is deployed.

PayPal checkout requires a matching Client ID and Client Secret from the selected environment. Set one clear backend value, normally `PAYPAL_ENV=live` or `PAYPAL_ENV=sandbox`; remove conflicting aliases. An OAuth access token is not a Client Secret.

## Validation boundary

The consolidated checks pass in the local source package. They do not establish production Supabase state, production backend routing, live PayPal OAuth/checkout/capture, or end-user behavior. Those still require manual verification after the owner installs and deploys the update.
