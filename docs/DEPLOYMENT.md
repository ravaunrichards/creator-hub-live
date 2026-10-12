# Creator Hub Creator Network — Deployment

## Architecture

Frontend/PWA → Node backend → Supabase

LIVE media → LiveKit

Payments → PayPal → backend verification → wallet ledger

## Required production configuration

Use the variables in `backend/.env.example`. Do not put service-role, LiveKit secret, PayPal secret or signing passwords into browser assets.

## Deploying the existing web app and backend

The static frontend and Node backend are separate services. Publish `frontend/` as the website root; deploy `backend/` as the Node service root. A successful static-site deployment does not deploy the backend or apply database migrations. The Leagues page requires the backend endpoint `GET /api/leagues/standings` and the Supabase tables created by migration `0008_server_authoritative_leagues.sql`.

## CORS

Set `FRONTEND_URL` to the actual production web origin(s). Set `PAYPAL_ENV=sandbox` only with sandbox client credentials, or `PAYPAL_ENV=live` with live credentials. Do not put a Postman access token into the environment; the backend obtains its own OAuth token. Verify OPTIONS/preflight and authenticated requests against the deployed service.

## LiveKit

Set `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` in the backend environment. There is no production fallback URL in the repaired backend.

## Android

The repository currently uses Android Gradle Plugin 8.5.2 and compile/target SDK 34. AGP 8.5 requires Gradle 8.7 and JDK 17 according to the Android compatibility documentation. citeturn0search1turn0search0

The supplied snapshot has no Gradle wrapper or Android SDK, so release compilation was not performed here.

## Sensitive signing material

The recovery ZIP does not redistribute the repository's private signing keystore. Preserve any existing local signing material privately; do not commit or send it with source packages.

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
