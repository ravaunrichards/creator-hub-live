# Creator Hub Creator Network — API Reference (Release 3.3.0)

## Authentication and trust boundaries

Protected operations require `Authorization: Bearer <Supabase access token>`. The backend validates the Supabase user and checks administrator access on every admin operation. Financial and competition writes are server/database-authoritative; browser code must not write balances, season status, fixtures, results or payouts directly.

## Health and public configuration

- `GET /api/health` — reports backend release identity, including `backendRelease: "3.3.0"` when this source is deployed.
- `GET /api/config/public` — reports browser-safe configuration, including normalized PayPal environment; it must not expose secrets.
- `GET /api/livekit/health`

Health/release values do not prove that database migrations or provider transactions succeeded.

## Teams

- `GET /api/teams` — list/search teams; optional `?q=` search.
- `POST /api/teams` — create a team. The server validates the name and uses server identity/ownership. Supported fields include `name`, `parish`, `description`, `logo_url`, `badge_url`, `max_members`.
- `GET /api/teams/:teamId` — team details and members.
- `PATCH /api/teams/:teamId` — owner-managed fields, including name, description, parish, logo/badge URL, member limit and recruiting status. Division/competitive score are not user-editable.
- `POST /api/teams/:teamId/join` — request membership under current team rules.
- `POST /api/teams/:teamId/leave` — leave a team under ownership/member safeguards.
- `DELETE /api/teams/:teamId/members/:userId` — owner removes a member under server checks.

Missing tables/columns return actionable schema diagnostics rather than generating fake teams. Review the preflight and migration prerequisites before changing the database.

## Existing team-league system (18 divisions)

Public-ish client reads below currently require an authenticated Supabase session:

- `GET /api/leagues/standings` — active-season standings; returns `{ season: null, standings: [] }` if no season is active.
- `GET /api/leagues/matches` — active-season fixtures/results; optional `?division=A1` through `?division=D5`; returns `{ season: null, matches: [] }` if no season is active.

Administrator operations:

- `GET /api/admin/leagues/seasons` — list seasons.
- `POST /api/admin/leagues/seasons` — create a season with `name`, ISO `starts_at`, ISO `ends_at`, and optional `activate` boolean. Actual season dates must be entered by the administrator; none are invented by the app.
- `POST /api/admin/leagues/seasons/:seasonId/activate` — activate an eligible scheduled season, initializing standings from real teams.
- `GET /api/admin/leagues/seasons/:seasonId/matches` — season fixture list.
- `POST /api/admin/leagues/seasons/:seasonId/fixtures/generate` — idempotently generate missing round-robin fixtures within each division.
- `POST /api/admin/leagues/matches/:matchId/result` — record a result with `home_score` and `away_score`.
- `POST /api/admin/leagues/matches/:matchId/correct` — correct a previously recorded result with the same score fields.
- `POST /api/admin/leagues/matches/:matchId/cancel` — cancel an eligible scheduled fixture.
- `POST /api/admin/leagues/seasons/:seasonId/finalize` — finalize an eligible season; database-side guards control promotion/relegation.

The official team divisions are A1–A3, B1–B5, C1–C5 and D1–D5. New teams begin in D5. Promotions/relegations are determined by completed season standings, not the legacy numeric `teams.level`. This model is separate from `/api/creator-leagues` and the `creator_leagues` tables.

## LIVE

- `POST /api/livekit/token`
- `GET /api/live/rooms`
- `POST /api/live/rooms`
- `GET /api/live/rooms/:id`
- `POST /api/live/rooms/:id/join`
- `POST /api/live/rooms/:id/start`
- `POST /api/live/rooms/:id/end`
- `GET|POST /api/live/rooms/:id/chat`

The start endpoint verifies the authenticated host is connected to the authoritative `room_name` and has camera and microphone tracks published before changing the room to `live`.

## Wallet and PayPal checkout

- `GET /api/wallet` and `GET /api/wallet/balance`
- `GET /api/wallet/transactions`
- `POST /api/wallet/gift`
- `POST /api/payments/paypal/create-order`
- `POST /api/payments/paypal/capture-order`
- `GET|PUT /api/payments/paypal/info` — authenticated creator reads/saves their own PayPal payout email; no provider secret is accepted here.
- `POST /api/payments/webhook`

Buy Coins first presents the payment-method selection step. PayPal is the currently supported provider; other methods must not be offered as available until integrated. PayPal checkout still requires matching backend credentials, configured webhook details where applicable, and a live test in the same environment.

## Creator payouts (manual PayPal processing)

- `GET /api/creator/payouts` — authenticated creator history.
- `POST /api/creator/payouts` — create a payout request using `amount` (whole-number diamonds) and an `Idempotency-Key` header. Requires a saved PayPal destination and adequate balance.
- `GET /api/admin/payouts` — administrator payout queue.
- `POST /api/admin/payouts/:withdrawalId/status` — administrator updates status using `status` (`approved`, `paid`, `rejected`), optional `fiatAmount`, `fiatCurrency`, `adminNote`, and `paypalTransactionId` (required to mark paid).

Requests debit diamonds and create a ledger entry atomically. Rejecting a request refunds diamonds once. A `paid` status is only a record of a **manually completed external PayPal transfer**; this release does not call PayPal Payouts API automatically and does not define a diamonds-to-fiat conversion rate. Never mark a request paid before confirming the real transaction.

## Verification boundary

Source/unit/contract tests pass locally. Live Supabase SQL execution, RLS/grant behavior, actual PayPal OAuth/checkout/capture/webhook, production CORS/deployment, LIVE media between real users and real-device responsive rendering remain unverified until run against the target services and devices.
