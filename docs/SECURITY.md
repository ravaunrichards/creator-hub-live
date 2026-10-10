# Creator Hub Creator Network — Security Review

## Corrections made in this source package

- Replaced private-looking credential values in `backend/.env.example` with placeholders.
- Added a repository-wide secret-hygiene check (`npm run security:check`).
- Excluded `android/app/release.keystore` and the two supplied APKs from this package.
- Kept privileged Supabase, LiveKit, and PayPal credentials server-side.
- Restricted LIVE host publishing tokens to LiveKit camera/microphone sources and guarded LIVE start against a concurrent end transition.
- Added request-body size limiting.
- Added PayPal captured order ID, amount, and currency checks before wallet credit.
- Added exact-origin CORS normalization and Android WebView origin guidance.

## Important incident response

The original supplied archive contained values in a file named `.env.example` that looked like real Supabase service-role, LiveKit, and PayPal credentials. Treat them as exposed. Rotate/revoke them in the relevant provider dashboards, update the deployed backend environment, and check repository history and deployment logs for further exposure. Do not reuse the old values.

The original archive also contained `android/app/release.keystore`. It has been excluded from this output. Because signing keys are sensitive and the archive documentation reports a certificate mismatch with the supplied APKs, do not assume this key is a valid production update key. Check the official Play Console signing state before publishing updates.

## Not verified externally

- Actual production environment variables and CORS allowlist
- Supabase migration state and live RLS behavior
- LiveKit cloud connectivity, media publishing, and viewer subscriptions
- PayPal sandbox/live order and webhook flows
- Android build, installation, camera/microphone permissions, and release signing
- Repository history and deployment logs for exposed credentials

## Required actions before production

1. Rotate exposed credentials and configure fresh values in the hosting provider.
2. Verify the frontend origin and Android WebView origin in `FRONTEND_URL`.
3. Back up the database and apply/verify migrations `0001`–`0013`.
4. Test payment idempotency and ledger balances in PayPal sandbox.
5. Confirm the real Android signing identity and test on-device.
