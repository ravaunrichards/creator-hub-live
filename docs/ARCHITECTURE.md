# Architecture

## Principles

1. **Server authoritative.** Roles, balances, points, winners, prices, and
   payment status are decided on the server. The client never submits a price,
   a balance, or a “success” that credits value.
2. **Money is explicit and typed.** Coins, diamonds, league points, ad credits,
   and withdrawable cash are distinct units in one append-only ledger. They are
   never implicitly equal; converting between them is a deliberate, rule-checked
   operation (not a silent division).
3. **Idempotent finance.** Every mutating ledger operation needs an idempotency
   key. Provider capture IDs and webhook event IDs are unique, so duplicate
   webhooks, retries, and refreshes cannot double-credit.
4. **No fake success.** An unconfigured provider throws `NotConfiguredError`;
   sandbox results are tagged `environment:'sandbox'`; local methods stay
   `pending` until an authorized reviewer or a verified webhook confirms.

## Ledger

`src/ledger/ledger.js` posts balanced double-entry postings inside a store
transaction. Per-unit deltas must sum to zero unless `allowMint` is set (used
only when externally-verified value enters the system, e.g. a captured card
payment minting coins from a `system:mint:coins` issuance account). User
accounts can never go negative; `system:*` issuance/sink accounts may, exactly
like an equity/issuance account in double-entry bookkeeping.

The store interface (`withTransaction`, `getIdempotent`, `putIdempotent`,
`appendEntries`, `getBalance`) is implemented by `MemoryStore` for tests/dev and
is the contract a Postgres store implements for production
(`ledger_entries` + `ledger_idempotency` in migration 0001, with the
`v_balances` view).

## Payments

```
client (hosted fields / PayPal buttons)
      |
      v
PaymentGateway.eligibleMethods(ctx)  -> only CONFIGURED + eligible methods
PaymentGateway.createIntent(provider) -> provider.createIntent()
      |                                        (PayPal / Card / LocalJM)
      v
provider webhook  --verify signature-->  mark intent captured
      |
      v
WalletService.creditCoinsFromPayment()  -> ledger.post (idempotent by capture id)
```

Provider adapters share the `PaymentProvider` contract in
`src/payments/providers/base.js`. Network I/O is injected (`httpClient`) so the
logic is testable offline and wired to real providers in production.

## Currency

`src/currency/currency.js` converts integer minor units through an injected
rate source. Each result is marked `estimate`, carries the rate `asOf`
timestamp, and flags `stale` / `unavailable`. The final charged amount is always
the provider-authorized settlement amount, not the estimate.

## LIVE & Exchange (schema-first)

Migrations define explicit state machines: `live_sessions.status`
(scheduled/live/reconnecting/ended), `live_participants.state`, and the Exchange
campaign/application/project/milestone/deliverable lifecycle. The runtime for
media (LiveKit), realtime, and the UI is scoped but not implemented in this pass
— see the feature matrix.
