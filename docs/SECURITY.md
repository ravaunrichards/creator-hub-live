# Creator Hub Live — Security Model

## Core Principles

1. **Server-authoritative:** All wallet mutations, payment captures, match results, and league standings are computed server-side. The frontend is a read-only view that can only request server actions.
2. **Default-deny RLS:** Every table has Row Level Security policies. The browser uses only the Supabase `anon` key, which is restricted by RLS to its own rows. The `service_role` key (server-side only) bypasses RLS for administrative and cross-user operations.
3. **No client-side secrets:** LiveKit API keys, PayPal client secrets, Supabase service role keys, and webhook IDs never reach the browser. LiveKit tokens are minted via `POST /api/livekit/token`.
4. **Idempotent payments:** Every mutating payment endpoint requires an `Idempotency-Key` header. The `payments` table has a unique constraint on `(user_id, idempotency_key)`. Duplicate webhooks, browser refreshes, and retries return the original result without double-crediting.

## What Lives Where

| Data | Server | Client |
|---|---|---|
| Wallet balances (coins, diamonds) | ✅ Read/write via RPC | ❌ Read-only display |
| LiveKit API key/secret | ✅ Token minting | ❌ Never sent |
| PayPal client secret | ✅ OAuth + API calls | ❌ Never sent |
| Supabase service role key | ✅ Cross-user operations | ❌ Never sent |
| Supabase anon key | — | ✅ Browser-safe |
| Match results | ✅ RPC `record_league_match_result` | ❌ Cannot submit directly |
| League standings | ✅ Computed from RPC | ❌ Read-only display |
| Payment status | ✅ DB + PayPal API | ❌ Read-only display |

## Authentication Flow

1. User authenticates with Supabase Auth (email/password, OAuth, magic link)
2. Supabase returns a JWT access token
3. Frontend sends `Authorization: Bearer <token>` on API requests
4. Backend verifies the JWT with Supabase Auth (`getUser(token)`) — never trusts client-submitted user IDs
5. Backend looks up the user's profile and role (`profiles` table) server-side

## RLS Policy Summary

- `profiles` — users can read all profiles, update only their own
- `wallets` — users can read their own wallet only
- `coin_ledger` — users can read their own ledger entries
- `payments` — users can read their own payments
- `live_sessions` — creators can insert/update their own; anyone can read live sessions
- `league_*` — read access for authenticated users; write via server RPC only

Full policies are in `database/migrations/0005_rls_policies.sql`.

## Payment Security

### Idempotency
- `Idempotency-Key` required on all mutating wallet/payment endpoints (16–200 chars)
- Unique constraint on `payments(user_id, idempotency_key)`
- PayPal `PayPal-Request-Id` header used for PayPal-side idempotency
- Webhook handler checks `provider_capture_id` before crediting

### Webhook Verification
- PayPal webhook signatures verified via `/v1/notifications/verify-webhook-signature`
- Only `PAYMENT.CAPTURE.COMPLETED` events trigger coin crediting
- Capture ID and order ID cross-referenced with existing payment record

### Refund
- Full-package refunds only (no partial amounts)
- Server debits the coin balance via `debit_coins` RPC
- Payment status updated to `refunded`

## Known Limitations

- The `developmentTokenServer` in LiveKit SDK is for sandbox testing only — it exposes the API secret to the browser. Production MUST use `/api/livekit/token`.
- The `release.keystore` in the Android directory is a development/placeholder key — replace before any production APK signing.
- See `docs/KNOWN_LIMITATIONS.md` for the full list.