# Creator Hub Live — API Reference

All endpoints require `Content-Type: application/json` for POST requests.
Authentication uses `Authorization: Bearer <supabase-token>` header.

## Health & Configuration

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | No | Service health check |
| GET | `/api/livekit/health` | No | LiveKit configuration status |
| GET | `/api/public-config` | No | Frontend-safe public configuration |

## LiveKit

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/livekit/token` | Yes | Mint a LiveKit room token |

**Request body:** `{ "roomId": "<live_session id>" }`

**Response:** `{ "token": "...", "serverUrl": "wss://...", "roomName": "...", "canPublish": true|false }`

The token is minted server-side. Only the room host gets `canPublish: true`. The room must exist in `live_sessions` and be in `live` (or `pending` for the host) status.

## Live Rooms

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/live/rooms` | Yes | Create a new live room |
| GET | `/api/live/rooms/:id` | Yes | Get room details |
| POST | `/api/live/rooms/:id/start` | Yes | Start a pending room (host only) |
| POST | `/api/live/rooms/:id/end` | Yes | End a room (host only) |
| POST | `/api/live/rooms/:id/join` | Yes | Join a room |
| POST | `/api/live/rooms/:id/leave` | Yes | Leave a room |

**Create room body:** `{ "title": "Stream Title", "category": "Just Chatting" }`

State machine: `pending` → `live` → `ended`. Only the host can start/end.

## Wallet & Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/wallet/balance` | Yes | Get coin/diamond balance |
| GET | `/api/wallet/transactions` | Yes | Transaction history (query: `?limit=N`) |
| POST | `/api/wallet/deposit` | Yes | Create PayPal order for coins |
| POST | `/api/wallet/purchase` | Yes | Spend coins (idempotent) |
| POST | `/api/wallet/gift` | Yes | Send a gift (idempotent) |
| POST | `/api/wallet/withdraw` | Yes | Request diamond withdrawal |

**Idempotency:** All mutating wallet endpoints require `Idempotency-Key` header (16–200 chars). Duplicate keys return the original result without double-crediting.

## PayPal

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/payments/create-order` | Yes | Create a PayPal checkout order |
| POST | `/api/payments/capture-order` | Yes | Capture a completed PayPal order |
| GET | `/api/payments/:id` | Yes | Get payment record |
| POST | `/api/payments/webhook` | No | PayPal webhook (signature verified) |
| POST | `/api/payments/refund` | Yes | Refund a captured payment (full) |

**Webhook** verifies the PayPal signature server-side before crediting coins.

## Leagues

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/leagues` | Yes | List all league tiers |
| GET | `/api/leagues/:code` | Yes | Get a specific league |
| GET | `/api/leagues/:code/seasons` | Yes | League seasons |
| GET | `/api/leagues/:code/teams` | Yes | League standings (query: `?seasonId=`) |
| GET | `/api/leagues/:code/matches` | Yes | League matches (query: `?seasonId=`) |
| GET | `/api/leagues/:code/standings` | Yes | Full standings |
| POST | `/api/leagues/:code/matches/:matchId/result` | Yes | Record match result (team authority) |
| POST | `/api/leagues/:code/matches/:matchId/correction` | Yes | Correct a match result (team authority) |
| POST | `/api/leagues/season` | Admin | Create a new season |
| POST | `/api/leagues/activate` | Admin | Activate a season |
| POST | `/api/leagues/match` | Admin | Create a league match |
| POST | `/api/leagues/finalize` | Admin | Finalize a season |

**Server-authoritative:** Match results are recorded via RPC calls. Standings are rebuilt server-side. Promotion/relegation is computed from the authoritative standings.

## Security Model

- **All balances, payments, match results, and standings are server-authoritative.** The frontend never directly mutates wallet balances or league standings.
- **Supabase RLS** enforces default-deny on all tables. The browser only uses the anon key.
- **LiveKit tokens** are minted server-side; the frontend never sees API keys/secrets.
- **PayPal secrets** are server-side only; webhook signatures are verified.
- **Idempotency keys** prevent double-crediting on retries/webhooks.