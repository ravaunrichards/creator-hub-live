# Creator Hub Creator Network — Security

## Verified source controls

- Browser source contains no detected Supabase service-role, LiveKit secret, PayPal secret, webhook secret or private-key text.
- LiveKit API credentials are backend-only.
- Host publishing tokens are restricted to camera/microphone sources.
- LIVE start is server-authorized.
- Wallet mutations use server-side ledger/RPC operations and idempotency.
- User settings and LIVE chat have RLS policies.
- Android release passwords are no longer hard-coded in `build.gradle`.
- Debug builds no longer reuse the release signing configuration.

## Signing-key handling

Private signing material is intentionally excluded from the recovery ZIP. Preserve any existing local signing key privately. Assess its history and rotate any exposed credentials in the real Git repository and provider consoles.

## Required production actions

- Rotate any private credentials that may have been exposed.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_SECRET`, PayPal secrets and signing passwords out of source.
- Confirm the production Android signing identity before shipping updates.
- Apply and verify all SQL migrations against the actual Supabase database.
