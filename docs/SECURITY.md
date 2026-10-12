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

## Signing-key finding

`android/app/release.keystore` exists in the repository snapshot. Its certificate fingerprint differs from the supplied APKs. The private key should be treated as sensitive and its history/provenance must be assessed in the real Git repository.

## Required production actions

- Rotate any private credentials that may have been exposed.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_SECRET`, PayPal secrets and signing passwords out of source.
- Confirm the production Android signing identity before shipping updates.
- Apply and verify all SQL migrations against the actual Supabase database.
