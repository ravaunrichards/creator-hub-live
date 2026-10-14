# Release 4.4.0 — Creator Hub Creator Network

**Type:** Future-version operability & resilience enhancement on the green
v4.3.0 baseline.
**Scope:** Additive and defence-in-depth only. No feature removals, no mocks,
no weakened tests, zero new runtime dependencies, full v4.0.2 rollback preserved.

## Changelog

### Added
- `backend/src/observability.js` — zero-dependency request-id, structured JSON
  access logging, and a streaming request-body size cap.
- `backend/tests/observability.test.js` — 8 unit assertions; added to the
  backend `npm test` chain and `npm run check`.
- `docs/RECOMMENDATIONS-4.4.0.md` — rationale, tunables, verification and
  blocked-in-sandbox status.

### Changed
- `backend/src/server.js`
  - `BACKEND_RELEASE` bumped `4.3.0 → 4.4.0`.
  - Per-request `X-Request-Id` header + structured JSON access log on `finish`.
  - `readRawBody()` now enforces a hard body-size cap (`413 PAYLOAD_TOO_LARGE`;
    default 1 MB, `MAX_REQUEST_BODY_BYTES`).
  - Graceful `SIGTERM`/`SIGINT` shutdown with a bounded force-exit timer.
  - Unref'd 5-minute interval prunes expired rate-limit buckets.
  - `GET /api/health` now reports `uptimeSeconds` + environment readiness
    (missing var **names** only, never values).
- `backend/package.json` — `npm run check` and `npm test` extended to cover the
  new module/test.
- Version markers bumped `4.3.0 → 4.4.0` across `frontend/index.html`,
  `frontend/config.js`, `frontend/config.example.js`, `frontend/styles/app.css`,
  `package.json`, and the service-worker cache (`chcn-web-v4-3-0 →
  chcn-web-v4-4-0`) in `frontend/sw.js`.
- Version expectations updated in `tests/integration-check.js`,
  `tests/complete-upgrade-contract.mjs`, and `tests/deployment-payment-check.mjs`.

### Deliberately NOT changed
- `rollback-4.0.2/` originals (full rollback kept intact).
- Installer scripts and database migrations.
- Historical `(v4.3.0 hardening)` code comments (accurate change history).

## Tunables / environment
| Variable | Default | Purpose |
|---|---|---|
| `MAX_REQUEST_BODY_BYTES` | 1000000 | Max accepted request body size (bytes) |
| `RATE_LIMIT_MAX` | 30 | Max requests per window per client+route |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate-limit window length (ms) |
| `RATE_LIMIT_DISABLED` | (unset) | Set `true` to disable rate limiting |

## Verification status
| Check | Result |
|---|---|
| Root `npm run check` static suite | PASS (260 passed / 0 failed) |
| Security source scan | PASS (158 files) |
| Migration static check | PASS (29 migrations) |
| Complete-upgrade contract | PASS |
| Backend route-check | PASS (71 routes / 19 endpoints) |
| Backend syntax | PASS (12/12) |
| Rate-limit unit tests | PASS (8/8) |
| Observability unit tests | PASS (8/8) |
| Overall exit code | 0 (GREEN) |

## Blocked / NOT verified in sandbox
Live render, signed APK, LiveKit media, live Supabase, real PayPal flow, and the
new observability/shutdown/body-cap behaviour under real traffic. All shipped as
real code + runbook, marked **ready but NOT executed here**.

## Security reminder
Rotate any previously exposed credentials (Supabase service-role, LiveKit
key/secret, PayPal client secret, PayPal webhook ID). This release cannot do
that for you.
