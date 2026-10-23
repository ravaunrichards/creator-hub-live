# Creator Hub Live Next

A **new, independent** codebase for a creator / livestream / commerce / monetization
platform. It is **not** a fork, rename, or re-layout of the reference project
(`ravaunrichards/creator-hub-live`); that repo was inspected only to understand
requirements and business rules (see `docs/INVENTORY.md`).

> **Honest scope statement.** This deliverable is the verified, running
> foundation — the **server-authoritative financial core** (the brief's
> stated highest priority), the payment-orchestration architecture, the
> database schema, and a runnable reference API — built and tested here with
> real, passing tests. The full product described in the master brief (full
> social app, three LIVE broadcast modes, media infrastructure, Android APK,
> complete Exchange UI, commerce, etc.) is **not** all implemented in this
> single pass. What is done, partial, and blocked is listed truthfully in
> `docs/FEATURE-COMPLETION-MATRIX.md` and `docs/BLOCKERS.md`. Nothing here is
> claimed as working that has not actually been run.

## What runs today (verified in this environment)

- **Double-entry, server-authoritative ledger** with idempotency, atomic
  postings, strict separation of balance units (coins / diamonds / league
  points / ad credits / cash), and overspend protection under concurrency.
- **Coin pricing** resolved server-side (client never sends a price); the
  requested reference packages (100–10,000 coins) plus bounded custom amounts.
- **Payment orchestration**: a modular gateway with provider adapters for
  **PayPal**, a **Visa/Mastercard card acquirer** (hosted-fields, no raw PAN),
  and **Jamaican local methods (Lynk/MyCash/bank)** in a manual-verification
  model. Unconfigured providers refuse to fake success and are never shown as
  available.
- **Currency conversion** with pluggable rate source, timestamps, and explicit
  stale / unavailable handling (no invented rates).
- **Gifts** that atomically debit coins and credit diamonds (kept separate
  from cash), idempotent per gift event.
- **Wallet credit** that happens **only** on a verified `captured` payment —
  never from frontend “success”, a receipt, or a screenshot.
- A **zero-dependency reference HTTP API** (`src/http/server.js`) wiring all of
  the above, bound to `127.0.0.1`.

## Requirements

- Node.js >= 16.17 (uses the built-in `node:test` runner). No npm dependencies.
- PostgreSQL 13+ (or Supabase) for the production store.

## Install & run

```bash
cp .env.example .env         # fill in real credentials (kept server-side)
npm test                     # run the unit/integration suite (27 tests)
npm run smoke                # boot the API in-process and exercise real flows
npm start                    # start the reference API on 127.0.0.1:8080
```

## Database

```bash
psql "$DATABASE_URL" -f database/migrations/0001_init.sql
psql "$DATABASE_URL" -f database/migrations/0002_exchange.sql
```

Migrations are additive and versioned. They create a **new** schema and never
touch the reference project's database.

## Security posture

- Secrets live only in `.env` (server-side). None are committed or zipped.
- Raw card numbers / CVV never reach CHL servers (hosted-fields tokenization).
- The reference API ships with a **stub** auth header and an in-memory store so
  the flows are runnable offline; both are flagged in code and MUST be replaced
  with real JWT/session auth + the Postgres store (with RLS) before deployment.

## Layout

```
src/ledger       double-entry ledger + in-memory store
src/pricing      coin packages + server-authoritative price resolution
src/currency     FX conversion with staleness handling
src/payments     gateway + provider adapters (paypal, card, local JM)
src/wallet       capture -> coin credit service
src/gifts        gift catalogue + atomic send
src/http         zero-dependency reference API
database         versioned SQL migrations
test             node:test suite
scripts/smoke.js end-to-end API smoke test
docs             inventory, architecture, feature matrix, blockers, test report
```

See `docs/` for the reference-repo inventory, architecture, the full
requirement-to-file matrix, known blockers, and the truthful test report.
