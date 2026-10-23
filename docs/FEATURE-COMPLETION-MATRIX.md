# Feature-Completion Matrix

Status legend: **DONE** (implemented + tested here) · **ARCH** (architecture /
schema in place, runtime not built) · **PARTIAL** · **NOT STARTED** ·
**BLOCKED** (needs an external credential/approval, named in BLOCKERS.md).

This matrix is deliberately honest. The master brief spans a multi-team,
multi-month product; this single pass delivers the financial core + payment
architecture + schema + a runnable API. Everything else is marked accordingly.

| Brief § | Requirement | Status | Evidence / files |
|---|---|---|---|
| 1 | Inspect reference repo, build inventory | DONE | `docs/INVENTORY.md` |
| 5 | Modular payment gateway (not PayPal-only) | DONE | `src/payments/gateway.js`, `test/payments.test.js` |
| 5 | Method selector shows only eligible+configured methods | DONE | `gateway.eligibleMethods`, smoke `no-unconfigured-methods` |
| 5.1 | Visa/Mastercard card adapter (hosted fields, no raw PAN) | ARCH+DONE(logic) | `src/payments/providers/cardGateway.js`, `test/payments.test.js` |
| 5.1 | Real card capture to a JM-eligible acquirer | BLOCKED | needs merchant account + API keys (BLOCKERS.md) |
| 5.2 | PayPal server-side order create + capture | DONE(logic) | `src/payments/providers/paypal.js`, `test/payments.test.js` |
| 5.2 | PayPal production settlement | BLOCKED | needs production client id/secret + verified webhook |
| 5.3 | Jamaican local methods (Lynk/MyCash/bank), manual-verify | DONE(logic) | `src/payments/providers/localJm.js`, `test/payments.test.js` |
| 5.3 | Automated local confirmation | BLOCKED | needs merchant API (not a consumer wallet) |
| 5.4 | Apple Pay / Google Pay | ARCH | via card gateway tokens; wallet eligibility gating needed |
| 5.5 | Google Play Billing / Apple IAP | NOT STARTED | requires store accounts + native app |
| 5.7 | Dynamic payment-method selector | DONE | `GET /api/payments/methods` |
| 6 | Server-authoritative wallet + ledger | DONE | `src/ledger/*`, `src/wallet/*`, `test/ledger.test.js`, `test/wallet-gifts.test.js` |
| 6 | Coin packages (100–10,000) + custom amounts | DONE | `src/pricing/*`, `test/pricing-currency.test.js` |
| 6 | Idempotent credits, no double-credit | DONE | `test/wallet-gifts.test.js` duplicate-capture |
| 6.1 | Currency conversion w/ stale/unavailable handling | DONE | `src/currency/currency.js`, `test/pricing-currency.test.js` |
| 6.2 | Separate balance units (coins/diamonds/points/cash) | DONE | ledger unit checks + tests |
| 7 | Gifts: atomic coin debit + diamond credit | DONE | `src/gifts/gifts.js`, `test/wallet-gifts.test.js` |
| 7 | Creator payouts | ARCH | payout destination + eligibility schema needed |
| 8 | Subscriptions / paid content / entitlements | NOT STARTED | schema stub only |
| 9 | Full social app (feeds, DM, profiles, search) | ARCH(schema) / NOT STARTED(runtime) | `database/migrations/0001` users/follows |
| 9.1 | Creator studio / editing | NOT STARTED | |
| 2,3,4 | Full-screen LIVE + 3 broadcast modes + multi-guest | ARCH(schema) / NOT STARTED(runtime) | `live_sessions`, `live_participants` + state machines |
| 11 | CHL Exchange marketplace | ARCH(schema) / NOT STARTED(runtime) | `database/migrations/0002_exchange.sql` |
| 12 | Creator commerce / shopping | NOT STARTED | |
| 13 | Promote / advertising / creative intelligence | NOT STARTED | |
| 14 | Programs / leagues / achievements | ARCH | `league_points` unit reserved |
| 15 | Music / effects / AI tools | NOT STARTED | |
| 16 | New premium 3D design system | NOT STARTED | gift asset slots defined in schema |
| 17 | Safety / moderation / trust | ARCH | account_type, verification flags, participant states |
| 18 | Backend/DB/security architecture | PARTIAL | ledger, migrations, idempotency, env-based secrets, 127.0.0.1 binding |
| 19 | Admin / operations | ARCH | manual-verify reviewer path exists (`confirmManual`) |
| 20 | Payment/Exchange test matrix | PARTIAL | card/paypal/local/idempotency/currency/gift covered; 3DS/refund-live BLOCKED |
| 21 | Full application tests | PARTIAL | financial + API smoke done; UI/media/device not built |
| 22 | Web + Android + release | NOT STARTED/BLOCKED | no Android toolchain in this environment |
| 23 | Source, migrations, env template, tests, README, ZIP | DONE | this project + delivered ZIP |

## Test evidence summary

- `npm test` — 27 tests across 4 files, all passing.
- `npm run smoke` — 8 end-to-end API assertions, all passing.
