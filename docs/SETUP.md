# Creator Hub Creator Network — Setup

## 1. Start with a backup

Keep the original archive unchanged. This corrected source package intentionally excludes the original `android/app/release.keystore` and the two supplied APK files because the key is sensitive and the APKs are not verified release artifacts. No new APK is included or claimed to be tested.

## 2. Backend environment

Use `backend/.env.example` as a placeholder-only template. Copy it to `backend/.env` for local work, then fill in values from your own service dashboards. Do not commit `backend/.env`.

Required variables:
- `PORT`
- `FRONTEND_URL` — comma-separated exact origins; include the actual deployed web origin and `https://appassets.androidplatform.net` for the Android WebView.
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server only
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET` — server only
- `PAYPAL_ENV` (`sandbox` until tested)
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET` — server only
- `PAYPAL_WEBHOOK_ID` if PayPal webhooks are configured
- `PAYPAL_RETURN_URL` — actual deployed frontend origin

Rotate any real private values that were present in the previously shared archive before deployment. Never copy private values from an old `.env.example`.

## 3. Database migrations

For a new database, apply migrations `0001` through `0013` in numeric order, using the intended Supabase project. `0003_wallet_payments.sql` and `0013_wallet_package_contracts.sql` contain schema contract fixes for the wallet, gift counter, and active coin-package catalog.

If earlier migration attempts failed, do not assume the database is complete. Check which migrations actually succeeded, back up the database, and apply the corrected missing migrations in order. Do not blindly rerun destructive SQL or delete production data.

## 4. Frontend and Android web assets

`frontend/` is the canonical web source. The Android app loads the packaged copy at `android/app/src/main/assets/web/`. After editing web files, run:

```bash
npm run sync:android-web
```

The root checks verify the two trees are byte-for-byte aligned. The browser configuration contains only public client configuration; all privileged service credentials belong in the backend environment.

## 5. Run local checks

Use Node.js 20 or later:

```bash
npm run check
npm run backend:check
npm run backend:test
npm run backend:smoke
npm run repair:contracts
```

These are static/contract checks and do not prove that the deployed Supabase, LiveKit, or PayPal services work end-to-end.

## 6. Android build

The archive does not include a Gradle wrapper and this environment has no Android SDK or installed Gradle. Open the `android/` project in Android Studio, install the required Android SDK and compatible Gradle tooling, then build a debug APK first. Do not create a production release until signing compatibility, permissions, camera/microphone, file picker, login, and LIVE have been tested on a physical Android device.
