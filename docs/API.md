# Backend API reference — Creator Hub Creator Network 4.0.0

## Trust and authentication

Protected requests use `Authorization: Bearer <Supabase access token>`. The backend validates the token and checks current account status. Administrative routes require the existing admin checks. Wallet, gifts, payout, LIVE lifecycle, teams/league management and account deletion remain server/database-authoritative. Never trust client-submitted account IDs or money amounts for privileged operations.

## Health/configuration

- `GET /api/health` — backend health and release marker.
- `GET /api/config/public` — browser-safe configuration only; must not include secrets.
- `GET /api/livekit/health` — LiveKit configuration/health indicator. A healthy response is not an end-to-end media test.

## Account lifecycle

- `POST /api/account/deactivate` — requires authenticated user and body `{ "confirm": "DEACTIVATE" }`. Marks the profile deactivated and disables Auth sign-in through the trusted backend. Migration 0024 adds RLS enforcement for old JWTs. Deactivation and reactivation policy must be operationally documented before production; users needing reactivation must contact support.
- `DELETE /api/account` — requires authenticated user and body `{ "confirm": "DELETE" }`. Deletes the Auth user using the server-only admin API. Actual cascaded record deletion is governed by database foreign keys; review financial/safety record retention and test with disposable accounts before enabling publicly.

## LIVE and media

- `POST /api/livekit/token` — authenticated scoped token issuance.
- `GET /api/live/rooms` and `POST /api/live/rooms` — list/create permitted LIVE rooms.
- Additional live-room lifecycle and guest operations are implemented in `backend/src/server.js` and `frontend/src/livekit.js`; use the current contracts/tests and check the API source before building a client against any route not described here.

## PayPal and wallet

- `POST /api/payments/paypal/create-order` — creates a PayPal order for an active database coin package.
- `POST /api/payments/paypal/capture-order` — captures the owned order and credits coins idempotently only after successful capture.
- `GET /api/payments/paypal/info` and `PUT /api/payments/paypal/info` — get/save the authenticated creator's PayPal payout destination email. This is not proof of PayPal ownership or a payout.
- `POST /api/payments/webhook` — validates provider webhook signature then reconciles supported events.
- `GET /api/wallet/packages`, `GET /api/wallet` (or `/api/wallet/balance`), `GET /api/wallet/transactions`, `POST /api/wallet/gift`, `GET /api/gifts` — actual package, balance, ledger, gift and catalog flows with existing auth/idempotency/authority rules.

Preserve the existing successful “Buy Coins” flow. Use PayPal client ID + client secret for the selected environment on the backend; never paste a temporary OAuth access token into browser config.

## Teams and competition

- `/api/teams` — team listing/search, creation, detail/edit, join/leave, member controls.
- `/api/leagues` — team competition season/fixtures/standings routes.
- `/api/admin/leagues` — authorized competition setup, results and finalization.
- `/api/creator-leagues` family — the separate creator-created league data model.
- `/api/payouts/*` — creator payout request/history and administrator review; actual external transfers are not automatically made by the request workflow.

For exact route/method/body/status rules, inspect `backend/src/server.js`, `backend/src/teams-routes.js`, `backend/src/team-leagues.js`, `backend/src/creator-leagues.js`, and `backend/src/payout-routes.js`. The backend route and contract tests are the source of truth for exact supported route strings.

## Account/community database-backed UI

The website queries migration-0024 objects/RPCs for gift rankings, invitation-based creator battles, active missions and manual reward claims, private verification applications, and approved public verification badges. These are Supabase contracts and are not generic public backend endpoints. The user interface must treat missing schema, permission failures, and empty records as visible states rather than inventing activity.
