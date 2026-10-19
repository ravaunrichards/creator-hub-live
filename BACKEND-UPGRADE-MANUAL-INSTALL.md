# Creator Hub Live — backend establishment foundation

This package is designed for **manual installation into the current Creator Hub Live repository**. It does not contain an old replacement copy of `backend/src/server.js`; the installer adds the changes to the version you already have and stops if the expected source anchors are missing or only partly installed.

## Included

- `backend/src/production-hardening.js` — request IDs, low-risk structured request-completion logs, sensitive-write token buckets, bounded rate-limit storage, request body limits and safe client-facing 5xx responses.
- `backend/tests/production-hardening.test.js` — unit tests for the hardening primitives.
- `backend/tests/backend-establishment-contract.test.js` — source contract for the installed route integration.
- `backend/package.json` and `backend/.node-version` — test scripts and Node 22 runtime declaration. Node 22+ is important because Supabase ended its Node 20 support on June 30, 2026. [Official Supabase notice](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20).
- `scripts/apply-backend-establishment.mjs` — fail-closed installer for the current server file.

The installer wires existing `live-room-experience.js` and `team-leagues.js` into the main request router, so the existing LIVE engagement/recording/moderation routes and team-season/league routes are actually reachable. It adds HTTP timeouts, bounded JSON/raw request reading, per-process write rate limiting, request correlation IDs, sanitised 5xx responses, and graceful shutdown.

## Install

1. Make a backup or branch of the current repository.
2. Extract this ZIP at the **repository root**, merging the included `backend/` and `scripts/` paths. Do not extract `backend/` into a second nested `backend/backend/` folder.
3. From repository root run:

   ```bash
   node scripts/apply-backend-establishment.mjs
   ```

4. Review the `backend/src/server.js` diff. The installer will not overwrite the server with a stale copy, and it stops if it cannot safely match the expected source version.
5. Use Node 22, then run:

   ```bash
   cd backend
   npm test
   npm run check
   ```

6. Do not deploy until both commands pass in the current repository and the deployment environment has been reviewed.

## Runtime configuration

The hardening layer supports these optional variables:

- `BACKEND_MAX_BODY_BYTES` — maximum accepted request body size; defaults to 1 MiB and caps at 10 MiB.
- `BACKEND_RATE_LIMIT_WINDOW_MS` — token-bucket refill window; defaults to 60,000 ms.
- `BACKEND_WRITE_RATE_LIMIT` — per-token/IP general write budget; defaults to 240 per window.
- `BACKEND_SENSITIVE_WRITE_RATE_LIMIT` — more restrictive budget for wallet/payment/payout/LIVE control writes; defaults to 45 per window.
- `BACKEND_RATE_LIMIT_MAX_KEYS` — upper bound on in-process bucket entries; defaults to 10,000.
- `BACKEND_NETWORK_WRITE_RATE_LIMIT` — generous per-network backstop for all write endpoints; defaults to 6,000 per window so rotating fake bearer tokens cannot evade all quotas.
- `BACKEND_NETWORK_SENSITIVE_WRITE_RATE_LIMIT` — per-network backstop for sensitive write routes; defaults to 900 per window.
- `BACKEND_RATE_LIMIT_ENABLED` — set to `false` only for controlled diagnostics, not as a permanent production workaround.
- `TRUST_PROXY_HEADERS` — default `false`. Set to `true` only when the hosting reverse proxy is trusted to overwrite/sanitize forwarding headers; otherwise a client can spoof its rate-limit identity.

The rate limiter uses both per-token/IP buckets and a more generous network backstop. It is **per Node process**, not a distributed quota. If multiple backend instances must share one global quota, use a shared atomic limiter (for example, Redis/Valkey or a database RPC) as a separate, measured phase.

## Deliberate scope boundaries

- No Supabase tables, policies, balances, payments, users, LIVE sessions, or recordings are created/deleted/modified by this package or installer.
- No GitHub push, Render environment edit, or deployment is performed.
- The existing PayPal and wallet flows remain the active flows.
- `payout-routes.js` is deliberately not wired by this package: its `diamond_withdrawals` contract differs from the current server's `diamond_payout_requests` contract. Blindly connecting both would risk payout regressions. Reconcile the schema and UI contract before replacing the current path.
- `creator-leagues.js` is not wired here because its entry-fee/payment route contract should be audited against the current frontend and DB before enabling a second payment workflow.

## Verification limits

Local hardening unit tests and installer-source checks are provided. The installed-source contract runs only after step 3. A passing local unit test is not evidence of a successful production deployment or live Supabase/LiveKit operation; run the full suite in the checked-out current repository before deploying.
