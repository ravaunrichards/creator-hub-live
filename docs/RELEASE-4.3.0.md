# Release 4.3.0 — Creator Hub Creator Network

**Type:** Production-hardening enhancement on top of the green v4.2.0 baseline.
**Scope:** Additive and defence-in-depth only. No feature removals, no mocks,
no weakened tests, zero new runtime dependencies, full v4.0.2 rollback preserved.

## Changelog

### Added
- `backend/src/rate-limit.js` — zero-dependency in-memory fixed-window rate
  limiter.
- `backend/src/env-check.js` — environment readiness validation (fail-fast in
  production, warn-only in dev).
- `backend/tests/rate-limit.test.js` — 8 unit assertions for the limiter and the
  env-readiness logic; added to the backend `npm test` chain and `npm run check`.
- `.github/workflows/ci.yml` — CI running `npm run check` on Node 20 for pushes
  and PRs.
- `docs/RECOMMENDATIONS-4.3.0.md` — rationale, tunables, verification and
  blocked-in-sandbox status.

### Changed
- `backend/src/server.js`
  - `BACKEND_RELEASE` bumped `4.2.0 → 4.3.0`.
  - Rate limiting applied to `/api/livekit/token`,
    `/api/payments/paypal/create-order`, `/api/payments/paypal/capture-order`,
    and `/api/account/deactivate` (webhooks excluded).
  - `secureHeaders()` now also sends
    `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
  - `assertEnvironmentReady()` is invoked before `server.listen`.
- `backend/package.json` — `npm run check` and `npm test` extended to cover the
  new modules/tests.
- Version markers bumped `4.2.0 → 4.3.0` across `frontend/index.html`,
  `frontend/config.js`, `frontend/config.example.js`, `frontend/styles/app.css`,
  `package.json`, and the service-worker cache (`chcn-web-v4-2-0 →
  chcn-web-v4-3-0`) in `frontend/sw.js`.
- Version expectations updated in `tests/integration-check.js`,
  `tests/complete-upgrade-contract.mjs`, and `tests/deployment-payment-check.mjs`.

### Deliberately NOT changed
- `rollback-4.0.2/` originals (full rollback kept intact).
- Installer scripts (`install-complete-upgrade.mjs`,
  `install-existing-project-repair.mjs`) — their payloads/base versions are left
  as-is.
- Database migrations — left as-is.

## Tunables / environment
| Variable | Default | Purpose |
|---|---|---|
| `RATE_LIMIT_MAX` | 30 | Max requests per window per client+route |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Window length in ms |
| `RATE_LIMIT_DISABLED` | (unset) | Set `true` to disable rate limiting |

## Verification status
| Check | Result |
|---|---|
| Root `npm run check` static suite | PASS (258 passed / 0 failed) |
| Security source scan | PASS (140 files) |
| Migration static check | PASS (29 migrations) |
| Complete-upgrade contract | PASS |
| Backend route-check | PASS (71 routes / 19 endpoints) |
| Backend syntax | PASS (11/11) |
| Rate-limit unit tests | PASS (8/8) |
| Overall exit code | 0 (GREEN) |

## Blocked / NOT verified in sandbox
Live render, signed APK, LiveKit media, live Supabase, real PayPal flow, and
rate-limiting under real multi-client load. All shipped as real code + runbook,
marked **ready but NOT executed here**.

## Security reminder
Rotate any previously exposed credentials (Supabase service-role, LiveKit
key/secret, PayPal client secret, PayPal webhook ID). This release cannot do
that for you.
