# Release 4.0.0 validation record

## What local checks cover

Run from the release root:

```sh
npm install
npm run check
npm run repair:contracts
```

The release checks include:

- Website-only package layout and required-file checks.
- Static structure checks for all 24 ordered SQL migrations (balanced comments/literals/dollar bodies/parentheses) and migration 0024 security/search-path/grant contracts. This is not a PostgreSQL parser or a live migration test.
- Browser script, service-worker shell asset, release version, and manifest consistency.
- Literal registered page paths, dynamic Teams route and internal hash-link checks.
- JavaScript syntax checks for all shipped frontend, backend, and test JavaScript.
- Browser asset scans for forbidden server-secret patterns.
- PayPal/LIVE/Teams/league/payout/creator-community contract checks.
- Backend routes and route smoke checks, backend syntax checks, LiveKit contracts, Teams and league operations, PayPal environment tests, and payout tests.

Final source-level run from the working release tree: `npm run check` passed with **237 website/source integrity assertions and zero failures**; the secret-pattern scan checked 94 source/config files with no matching private-credential patterns. The 24 SQL migrations passed a static structure scan, not PostgreSQL parsing or live migration execution. The backend route, syntax, LIVE/LiveKit, Teams, league, PayPal environment, payout and account/community contracts passed. `npm run repair:contracts` passed. A local static HTTP smoke test returned HTTP 200 for 20/20 unique local references found in `frontend/index.html` (scripts, styles, icon, manifest) plus the service worker. This checks static HTTP delivery only. Headless Chromium navigation was blocked by this environment (\`ERR_BLOCKED_BY_ADMINISTRATOR\`) for both local HTTP and file URLs, so **visual rendering was not marked passed**. See `LOCAL-TEST-RESULTS-4.0.0.txt` for the exact boundary.

Passing local/source tests do not prove live credentials, schema readiness, real transactions, production deployment, or browser rendering.

## Required manual release acceptance

1. Confirm the production repository/service and active release are the intended Creator Hub project.
2. Back up backend configuration and take a Supabase backup/export.
3. Run `database/diagnostics/creator_community_preflight.sql` and the existing full schema inventory/preflight scripts. Save the output.
4. Compare actual installed migrations/tables/functions/policies with the package. Do not run an already applied migration blindly.
5. Confirm backend environment variables using `backend/.env.example` as names-only guidance; secret values remain server-side.
6. Deploy backend using the hosting provider's documented method and verify `/api/health` and `/api/config/public`.
7. Apply approved missing database migrations in dependency order, especially migration 0024, only after reviewing its policy and FK effects against the real schema.
8. Deploy `frontend/` as the static site root. Preserve the existing correct public config values from this package; never substitute placeholders from `config.example.js` into production.
9. Test registration/login, profile save and photo upload, privacy, blocked users, follows, posts, messaging and notifications with two real test accounts.
10. Test PayPal purchase from “Buy Coins” through approval, capture, idempotent ledger credit, cancellation and a declined/failed request. Use safe test transactions before any production-money test.
11. Test LIVE start/join/chat/guest and end flows with valid LiveKit credentials and two devices/accounts.
12. Test team creation/join/leave, owner edit/member removal, season fixtures/standings, admin result flow, and payout review with non-production test users.
13. Test deactivation and deletion with dedicated disposable accounts only after auditing cascade behavior, retention obligations and provider policies. Do not use a real owner account as a test.
14. Test the site at narrow mobile, tablet, laptop and desktop widths; keyboard navigation; screen-reader labels; browser back/refresh; offline startup; and service-worker update behavior.
15. Record observed failures, logs, schema state, provider request IDs and rollback action before production sign-off.

## Local results

The definitive counts and pass/fail status must come from the final `npm run check` output for the exact ZIP. The check output is included with the release. If any command fails, fix or document the failure before installation; do not consider a partially green run release acceptance.
