# Nexus Edition 6.0.2 — manual install and deployment guide

## Package scope

This package continues the existing Creator Hub Creator Network project. The website publish directory is `frontend`; the existing backend service root is `backend`; Android WebView assets live at `android/app/src/main/assets/web/`. The package includes all recovered gift artwork, animated SVGs, distinct WAV effects, badges and multi-guest artwork. It is not deployed automatically.

## Required local checks

From the project root run:

```sh
npm run check
npm run studio:sync-android
npm run check
```

The verified local QA record is `docs/FINAL-QA-RESULTS-NEXUS-6.0.2.md`.

## Render services

Keep the existing service settings and environment values, and deploy the source manually only after staging acceptance. Configure `backend/.env.example` entries in the host dashboard. Supabase service-role key, LiveKit API secret, PayPal client secret, recording-storage keys and recording-cleanup secret belong in backend environment settings only. They must not be put in frontend configuration or the ZIP.

Website static publish directory: `frontend`. API service root: `backend`; Node.js 20+ is required. The build/start commands for the backend are `npm install` and `npm start` from `backend/`. Configure the frontend API base for the existing API URL. Do not replace live service settings with invented example credentials.

## Database and migration order

Nexus currently has `database/migrations/0025_live_guest_request_workflow.sql`. This package adds `0026_nexus_live_room_experience.sql`. The historical repository used some of 0025–0029 for other migration content, so do not blindly append the historical migrations or run the old gift-pricing migration. Back up the target database, inspect the applied migration ledger/schema and existing RLS policies, execute the diagnostics under `database/diagnostics/`, then review/test migration 0026 in staging before production. This is not a migration that should be pasted into production without the preflight.

Migration 0026 creates RLS-protected moderator, poll/vote, reaction, question and private recording tables. It does not seed test activity, change prices or write balances. The service-role backend handles mutations. Keep the existing server-authoritative `send_gift` RPC and real database pricing. Do not invent diamond conversion values.

## Optional LIVE recording setup

Configure valid `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` plus `LIVE_RECORDING_S3_BUCKET`, `LIVE_RECORDING_S3_REGION`, `LIVE_RECORDING_S3_ACCESS_KEY` and `LIVE_RECORDING_S3_SECRET_KEY` in the backend environment. Use a private bucket. Optional values include `LIVE_RECORDING_S3_ENDPOINT`, `LIVE_RECORDING_S3_FORCE_PATH_STYLE` and `LIVE_RECORDING_CLEANUP_SECRET`. A missing setting intentionally blocks recording with a clear error. Test Egress start/stop/upload, signed download and delete against a non-production storage bucket before relying on this feature.

## Android and iPhone

Run `npm run studio:sync-android` whenever frontend assets change, then check parity. Gradle project source is included. The historical APKs were not rebuilt/signed as part of this package because Android SDK/Gradle tooling is unavailable in the packaging environment. Build with a compatible Android SDK/Gradle toolchain and sign using authorized keys held securely outside the ZIP. `frontend/index.iphone.html` is an iPhone-oriented web entry, not an IPA.

## Production acceptance

Before production, test authenticated signup/sign-in, routes and API health; the actual migration/RLS behavior; LIVE start/end/chat/guests/polls/Q&A/moderation; gift media and successful server-confirmed gift transactions; PayPal Sandbox capture and payout; teams/leagues; responsive navigation; offline/PWA; Android camera/microphone permissions; and the iPhone web experience. Source contracts and mocked browser smoke cannot substitute for these service/device checks.
