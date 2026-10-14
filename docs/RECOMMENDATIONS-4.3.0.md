# Creator Hub Creator Network — v4.3.0 Production-Hardening Recommendations

This release is an **enhancement pass on the existing project**, not a rewrite.
It adds defence-in-depth and operational-safety improvements on top of the
already-green v4.2.0 baseline, while preserving every hard rule: real work (not
audit-only), honest PASS/FAIL/BLOCKED status, no mocks/fakes, all authoritative
logic server-side, zero runtime dependencies added, and a full v4.0.2 rollback
kept intact.

## What changed in v4.3.0 (implemented and verified)

### 1. Request rate limiting on cost-bearing / destructive endpoints
- New zero-dependency, in-memory fixed-window limiter: `backend/src/rate-limit.js`.
- Wired into the native `http.createServer` handler in `backend/src/server.js`,
  applied to these POST routes:
  - `/api/livekit/token` (prevents token-minting abuse)
  - `/api/payments/paypal/create-order`
  - `/api/payments/paypal/capture-order`
  - `/api/account/deactivate` (destructive)
- **Webhooks are intentionally excluded** so legitimate PayPal retries are never
  dropped.
- Defaults: 30 requests / 60s per client+route. Tunable via
  `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`; disable entirely with
  `RATE_LIMIT_DISABLED=true`.
- Responses include `X-RateLimit-Limit` / `X-RateLimit-Remaining`, and a 429 with
  `Retry-After` + `{ ok:false, code:"RATE_LIMITED" }` when exceeded.
- This is **defence-in-depth only** — every route still enforces full
  server-side authority (auth, balances, winners, payment state) independently.

### 2. HTTP Strict Transport Security (HSTS)
- Added `Strict-Transport-Security: max-age=31536000; includeSubDomains` to the
  shared `secureHeaders()` helper, alongside the existing nosniff / frame-DENY /
  referrer protections. Harmless over plain HTTP; enforced once served over TLS.

### 3. Fail-fast environment readiness check
- New `backend/src/env-check.js` validates required credentials before the
  server accepts traffic.
  - **Required** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`): in production a
    missing value throws and the process exits non-zero instead of silently
    500ing on every write. In non-production it only warns.
  - **Recommended** (LiveKit / PayPal / anon key): logged as warnings; the
    affected feature degrades but the server still boots.

### 4. Continuous Integration
- `.github/workflows/ci.yml` runs the full static-contract suite + backend unit
  tests (`npm run check`) on Node 20 for every push and PR. No secrets required.

### 5. Tests
- `backend/tests/rate-limit.test.js` (8 assertions) covers limit enforcement,
  window reset, per-key isolation, forwarded-IP keying, bucket pruning, and the
  env-readiness logic. Added to the backend `npm test` chain and `npm run check`.

### 6. Version markers
- All app/backend/service-worker version markers bumped `4.2.0 → 4.3.0` and the
  SW cache `chcn-web-v4-2-0 → chcn-web-v4-3-0` so the stale shell is dropped.
- The three version-asserting contract tests were updated to expect 4.3.0.
- The `rollback-4.0.2/` originals and the installer scripts were deliberately
  left untouched.

## Verification (this sandbox)
- `npm run check` (root): full static-contract suite **258 passed / 0 failed**,
  security source scan PASS, migrations PASS, upgrade contract PASS.
- Backend `npm test`: route-check **71 routes / 19 endpoints**, backend syntax
  11/11, live/social contract PASS, rate-limit **8/8**.
- Overall exit code: 0 (GREEN).

## Not verified here (environment-blocked — honest status)
The sandbox has no browser, camera, cloud network, DB credentials, or Android
toolchain, so the following remain **ready but NOT executed/verified**:
- Live visual render / device responsiveness
- Signed Android APK build
- Real LiveKit media session
- Live Supabase (hosted DB) behaviour
- Real PayPal order/capture/webhook flow
- The rate limiter under real multi-client load (logic unit-tested only)

## Operational notes
- The in-memory limiter is per-process. For horizontally-scaled deployments,
  back it with a shared store (e.g. Redis `INCR`+`EXPIRE`) using the same
  `route|clientIP` key scheme; the limiter module is structured so this swap is
  localized.
- **Rotate any credentials** that may have been committed or exposed previously
  (Supabase service-role key, LiveKit API key/secret, PayPal client secret and
  webhook ID). This release does not and cannot do that for you.

## Rollback
- To revert, restore the files under `rollback-4.0.2/` as documented in the
  existing rollback notes. v4.3.0 does not remove or alter that path.
