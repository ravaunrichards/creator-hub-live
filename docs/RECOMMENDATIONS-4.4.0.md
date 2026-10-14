# Creator Hub Creator Network — v4.4.0 Future-Version Hardening

This is the next enhancement pass on top of the green v4.4.0 lineage (v4.2.0 →
v4.3.0 → v4.4.0). It focuses on **operability and resilience** — the things a
production service needs to be observable, debuggable, and safe under abuse —
while keeping every hard rule: real work (not audit-only), honest
PASS/FAIL/BLOCKED status, no mocks/fakes, all authoritative logic server-side,
zero new runtime dependencies, and a full v4.0.2 rollback preserved.

## What changed in v4.4.0 (implemented and verified)

### 1. Per-request correlation IDs + structured access logging
- New zero-dependency module `backend/src/observability.js`.
- Every response now carries an `X-Request-Id` (a safe client-supplied id is
  reused when present, otherwise a fresh UUID is minted).
- One structured JSON access-log line is emitted per request on `finish`
  (`id`, `method`, `path`, `status`, `durationMs`, `ip`). Logging is fully
  guarded so it can never throw and break a response. **No secret values are
  ever logged.**

### 2. Hard request-body size cap (DoS protection)
- `readRawBody()` now streams through `readRawBodyLimited()` with a byte cap and
  aborts as soon as it is exceeded, returning `413 PAYLOAD_TOO_LARGE` instead of
  buffering an abusive upload to memory exhaustion.
- Default 1 MB; tunable via `MAX_REQUEST_BODY_BYTES`.

### 3. Graceful shutdown
- `SIGTERM` / `SIGINT` now stop accepting new connections, drain in-flight
  requests via `server.close()`, then exit cleanly. A bounded 10s timer forces
  exit if draining stalls, so orchestrators (e.g. Render) get a clean, timely
  rollover instead of dropped connections.

### 4. Bounded rate-limiter memory
- An unref'd 5-minute interval prunes expired rate-limit buckets, so the
  in-memory map introduced in v4.3.0 cannot grow unbounded for one-off clients.

### 5. Richer health endpoint
- `GET /api/health` now also reports `uptimeSeconds` and an environment
  readiness summary (`ready`, and the **names** — never values — of any missing
  required/recommended variables), making liveness/readiness probes meaningful.

### 6. Tests
- `backend/tests/observability.test.js` (8 assertions): request-id reuse/mint,
  client-IP extraction, guarded JSON logging, body-size override/default, and
  streaming body cap enforcement. Added to the backend `npm test` chain and
  `npm run check`.

### 7. Version markers
- All app/backend/service-worker markers bumped `4.3.0 → 4.4.0`; SW cache
  `chcn-web-v4-3-0 → chcn-web-v4-4-0` so the stale shell is dropped. The three
  version-asserting contract tests were updated to expect 4.4.0.
- `rollback-4.0.2/`, the installer scripts, and migrations were left untouched.
  Historical `(v4.3.0 hardening)` comments in the rate-limit/env modules are
  intentionally left as accurate change history.

## Verification (this sandbox)
- `npm run check` (root): **260 passed / 0 failed**, security source scan PASS
  (158 files), migrations PASS (29), upgrade contract PASS.
- Backend `npm test`: route-check **71 routes / 19 endpoints**, backend syntax
  **12/12**, rate-limit **8/8**, observability **8/8**.
- Overall exit code: 0 (GREEN).

## Not verified here (environment-blocked — honest status)
The sandbox has no browser, camera, cloud network, DB credentials, or Android
toolchain, so these remain **ready but NOT executed/verified**:
- Live visual render / device responsiveness
- Signed Android APK build
- Real LiveKit media session
- Live Supabase (hosted DB) behaviour
- Real PayPal order/capture/webhook flow
- Access logging, request-id propagation, graceful-shutdown timing, and the
  body-size cap under real traffic (all logic unit-tested only)

## Operational notes
- Access logs are plain JSON lines on stdout; ship them to your log aggregator
  as-is. Correlate client reports with the `X-Request-Id` echoed to the browser.
- For horizontally-scaled deployments, the in-memory rate limiter remains
  per-process; back it with a shared store (Redis `INCR`+`EXPIRE`) using the
  same `route|clientIP` key scheme. The pruning timer is only relevant to the
  in-memory implementation.
- **Rotate any previously exposed credentials** (Supabase service-role key,
  LiveKit API key/secret, PayPal client secret and webhook ID). This release
  does not and cannot do that for you.

## Rollback
- To revert, restore the files under `rollback-4.0.2/`. v4.4.0 does not remove
  or alter that path.
