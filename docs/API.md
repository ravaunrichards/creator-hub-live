# Creator Hub Live — API

## Health/config

- `GET /api/health`
- `GET /api/livekit/health`
- `GET /api/config/public`

## Authentication

Protected operations require `Authorization: Bearer <Supabase access token>`. The backend derives identity from the verified Supabase user.

## LIVE

- `POST /api/livekit/token`
- `GET /api/live/rooms`
- `POST /api/live/rooms`
- `GET /api/live/rooms/:id`
- `POST /api/live/rooms/:id/join`
- `POST /api/live/rooms/:id/start`
- `POST /api/live/rooms/:id/end`
- `GET|POST /api/live/rooms/:id/chat`

The start endpoint verifies the authenticated host is connected to the authoritative `room_name` and has both camera and microphone tracks published before changing status to `live`.

## Wallet/payments

- `GET /api/wallet`
- `GET /api/wallet/balance`
- `GET /api/wallet/transactions`
- `POST /api/wallet/gift`
- `POST /api/payments/paypal/create-order`
- `POST /api/payments/paypal/capture-order`
- `GET|PUT /api/payments/paypal/info`
- `POST /api/payments/webhook`

Financial mutations remain server-authoritative and use ledger/idempotency controls.

## Verification status

Static route/security checks pass. Live provider behavior remains **UNVERIFIED** until real Supabase, LiveKit and PayPal environments are available.


## Diamond payouts (admin-confirmed fiat amount)

- `GET /api/payouts?limit=20` — authenticated creator's payout history.
- `POST /api/payouts` — authenticated creator requests a whole-number diamond amount; requires `Idempotency-Key` (16–200 characters) and a saved PayPal payout email. The server atomically reserves diamonds and records the ledger entry.
- `GET /api/admin/payouts?status=pending&limit=50` — admin-only payout queue. Supported statuses: `pending`, `approved`, `rejected`, `paid`.
- `PATCH /api/admin/payouts/:id` — admin-only actions: `approve` with `fiatAmount` and three-letter `fiatCurrency`; `reject` (server refunds reserved diamonds once); or `mark_paid` with `paymentReference` after the PayPal transfer has actually been sent. Optional `adminNote` is recorded.

The application intentionally does not calculate a diamond-to-fiat exchange rate and does not automatically send PayPal payouts. The administrator must confirm the exact payable amount/currency, send the transfer through PayPal, and then record its transaction reference.
