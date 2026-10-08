# Creator Hub Creator Network — API

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
