# Creator Hub Creator Network — Test Report

Date: 2026-10-12. These results are from the local Release 3.2.6 source package.

## Automated local results

| Check | Result |
|---|---|
| Project structure and required files | PASS — 96 checks, 0 failed |
| Frontend and bundled web asset parity | PASS — synchronized files byte-identical |
| Source secret-pattern scan | PASS — 114 source/config files scanned |
| Payment chooser, cache version and deployment contracts | PASS |
| Teams API/UI/database contract checks | PASS |
| Official 18-division hierarchy contract | PASS |
| Browser route registry | PASS — 69 routes checked |
| Backend JavaScript syntax | PASS — 7/7 files |
| LIVE authorization and room contract tests | PASS |
| Team standings route tests | PASS — active season, no-active-season empty state and schema diagnostics |
| Admin season API tests | PASS — authorization, active-window validation, duplicate-active protection and standings initialization |
| PayPal environment tests | PASS — aliases, case-insensitive variable names and blank-key fallback |

Run `npm run check` from the repository root or `cd backend && npm test` for the backend test suite.

## Not established

These tests do not connect to the actual Supabase instance, the production backend host, live PayPal, or real browsers/devices. The SQL migration was reviewed against the included migrations and schema contract but was not executed against the user's live database. PayPal OAuth/order/capture/webhook behavior, actual deployed routing, production authentication, RLS/policies, network/CORS and user-device layout remain unverified until the owner tests them after manual installation.

The backend health endpoint now exposes `backendRelease: "3.2.6"` so deployment identity can be checked. Seeing that marker confirms the backend version only; it does not prove that environment values, database migrations, payment configuration, or the entire production workflow are correct.
