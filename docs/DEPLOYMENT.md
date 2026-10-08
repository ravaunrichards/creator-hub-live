# Creator Hub Creator Network — Deployment

## Architecture

Frontend/PWA → Node backend → Supabase

LIVE media → LiveKit

Payments → PayPal → backend verification → wallet ledger

## Required production configuration

Use the variables in `backend/.env.example`. Do not put service-role, LiveKit secret, PayPal secret or signing passwords into browser assets.

## CORS

Set `FRONTEND_URL` to the actual production web origin(s). Verify OPTIONS/preflight and authenticated requests against the deployed service.

## LiveKit

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in the backend environment. There is no production fallback URL in the repaired backend.

## Android

The repository currently uses Android Gradle Plugin 8.5.2 and compile/target SDK 34. AGP 8.5 requires Gradle 8.7 and JDK 17 according to the Android compatibility documentation. citeturn0search1turn0search0

The supplied snapshot has no Gradle wrapper or Android SDK, so release compilation was not performed here.

## Release signing

Release credentials are read from Gradle properties/environment variables. The keystore is retained for compatibility analysis, but its certificate does not match the supplied APK certificate. Do not replace the signing identity without establishing update compatibility.

## Deployment verification

Required real checks:

1. deploy backend;
2. `GET /api/health`;
3. `GET /api/livekit/health`;
4. authenticated Supabase flow;
5. LiveKit host camera/microphone publication;
6. PayPal sandbox/live verification as appropriate;
7. Android installation and launch.

These external checks are BLOCKED/UNVERIFIED in the supplied archive environment.
