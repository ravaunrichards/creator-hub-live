# Test Report (truthful)

Environment: Node v16.20.2, no npm dependencies, no database, no browser, no
Android toolchain. All results below were produced by actually running the
commands in this environment.

## `npm test` — unit / integration (node:test)

Result: **PASS**. 4 test files, **27 tests**, 0 failures (exit 0).

| File | Tests | Covers |
|---|---|---|
| `test/ledger.test.js` | 6 | balanced transfer, idempotent replay, insufficient-funds atomicity, unbalanced rejection, unit separation, concurrent overspend protection |
| `test/pricing-currency.test.js` | 8 | server-authoritative package + custom pricing, client price ignored, FX estimate/timestamp, stale rate flag, unavailable rate, same-currency exactness |
| `test/wallet-gifts.test.js` | 7 | credit only on captured, frontend-success credits nothing, exact coin credit, duplicate-webhook no double-credit, atomic gift debit/credit, insufficient-coin gift rejected, idempotent gift event |
| `test/payments.test.js` | 6 | unconfigured not advertised, unconfigured refuses fake success, country/currency eligibility, honest card status mapping, PayPal order+capture (sandbox-flagged), local method stays pending + needs authorized manual confirm |

## `npm run smoke` — end-to-end API

Result: **PASS**. 8/8 assertions (exit 0), boots `src/http/server.js` in-process
on `127.0.0.1`:

```
PASS  health
PASS  no-unconfigured-methods        (empty list when nothing configured — honest)
PASS  auth-required                  (401 without x-user-id)
PASS  coins-credited-on-capture      (pkg_2500 -> 2500 coins)
PASS  duplicate-capture-idempotent   (same providerRef does not re-credit)
PASS  balance-not-double-credited    (balance stays 2500)
PASS  gift-sent                      (crown x1 -> 100 coins)
PASS  coins-debited-after-gift       (2500 -> 2400)
```

## Not verified here (and why)

- Live PayPal/card/local **production** captures, 3-D Secure, real refunds —
  require real merchant credentials (see `docs/BLOCKERS.md`). Adapter logic is
  unit-tested with injected HTTP; the network path is NOT exercised here.
- Live Postgres/Supabase + RLS — migrations are static-validated by review, not
  applied against a live DB (no `DATABASE_URL`).
- LiveKit media, camera/mic, device responsiveness, signed Android APK — no
  toolchain / media / device in this environment. Marked NOT VERIFIED, not
  claimed working.
