# Creator Hub Creator Network — Deployment

## Architecture

- Web/PWA frontend → Node backend → Supabase
- LIVE audio/video → LiveKit
- Coin purchases → PayPal → backend verification → server-side wallet ledger

## Backend environment

Set real values in the hosting provider's environment panel. Use `backend/.env.example` only as a placeholder guide. Never put Supabase service-role keys, LiveKit API secrets, PayPal secrets, webhook secrets, or release passwords in browser assets.

`FRONTEND_URL` accepts comma-separated exact origins. Set it to the actual production web origin and include `https://appassets.androidplatform.net` for the Android WebView origin. Origins must be exact, without paths. Verify CORS preflight and authenticated calls against the deployed service.

## LiveKit

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in the backend environment. The backend issues short-lived tokens and only grants camera/microphone publishing to the room host. The backend rejects tokens for ended sessions and viewers entering a pending session. The LIVE start endpoint verifies host camera and microphone publication before transitioning the database row to `live`.

## Supabase database

Apply and verify migrations `0001` through `0013` in order. Check the actual database state; a file existing in the repository does not mean it was applied to Supabase.

## PayPal

Use sandbox mode first. Coin package amounts are read from active USD rows in `coin_packages`; the browser no longer owns the price list. The backend checks the capture order ID, captured amount, and currency before crediting coins. Test successful payment, cancellation, repeated capture, mismatched amount, and failed provider responses before enabling live payments.

## Android

The project uses Android Gradle Plugin 8.5.2 and SDK level 34. No Gradle wrapper or Android SDK was present in the supplied archive environment, so an APK build and real-device installation were not performed here. Open the `android/` project in Android Studio, configure compatible build tools, and test on a physical Android device.

## Release signing

The supplied keystore was excluded from the corrected source package because signing material must not be redistributed. The supplied APKs were also excluded because their update compatibility and installability were not independently verified. Determine the official signing identity from Google Play Console (if already published) before creating an update. Do not replace an existing signing key without checking the Play App Signing/upload-key situation.

## Required live verification

1. Deploy the backend and verify `GET /api/health` and `GET /api/livekit/health`.
2. Sign in with a real test account.
3. Create a LIVE room, publish camera and microphone, and confirm the backend marks it `live` only after verification.
4. Confirm viewers cannot publish and cannot receive a token for pending/ended rooms.
5. Test chat and gifts with a funded test wallet and real database catalog.
6. Test PayPal sandbox capture and verify exactly one ledger credit.
7. Install the Android debug build and test login, camera/microphone, app permissions, file picker, navigation, and reconnect behavior.

These live-service checks remain unverified until performed against the user's actual deployment.
