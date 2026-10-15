# Nexus Edition 6.0.0 — Deployment Guide

## What this package is
This is a full source release of Creator Hub Creator Network, using the existing frontend, backend, ordered database migrations and Android WebView wrapper, with the Nexus futuristic UX refresh. It is not a hosted URL or a newly signed APK.

## 1. Prepare the release
1. Extract the ZIP to a clean directory.
2. Install Node.js 20 or newer.
3. Review `frontend/config.js` and `frontend/config.example.js`. Configure only browser-safe values in the frontend; never put service-role keys, LiveKit secrets, PayPal secrets, or signing passwords in browser files.
4. Configure the backend from `backend/.env.example` using your own secure deployment environment.
5. Check that the existing Supabase project has the required schema. Read `docs/DATABASE.md` and `docs/INSTALL-4.2.0.md`; do not blindly replay historical migrations against a live database.

## 2. Deploy the website
For a static host such as Render Static Site, create a Static Site from this source repository/package. Set the publish directory to `frontend`. No build command is required for the plain-script frontend. Set the correct public API base and Supabase URL/publishable key in `frontend/config.js` before publishing. Configure SPA/hash routing and HTTPS according to the host.

## 3. Deploy the API
Deploy `backend` as a Node web service with Node.js 20+. Build/install from the `backend` directory using `npm install`; start command: `npm start`. Add environment variables from `backend/.env.example` in the host dashboard. Configure the frontend API base to the deployed API origin. Keep Supabase service role, LiveKit API secret, and PayPal client secret server-only.

## 4. Verify staging before production
From the repository root run:

```sh
npm run check
npm run studio:sync-android
npm run check
```

Then use a staging account to verify sign-in/sign-up, route navigation, creator profile, search, LIVE permissions/device media, chat, wallet package loading, payment-method selection, PayPal sandbox order/capture, payout workflow, teams/leagues, settings, and mobile layout. The automated checks validate source contracts and tests; they do not prove external credentials or a live payment/stream is working.

## 5. Android and iPhone
- The website source is copied into `android/app/src/main/assets/web` and checked for parity.
- To rebuild the Android wrapper, use Android Gradle Plugin/SDK compatible with the included Gradle configuration, run `cd android && ./gradlew assembleDebug` (Windows: `gradlew.bat assembleDebug`). A release build must be signed with your own authorized keystore and secure credentials. The historical APK in this package is not a Nexus 6.0.0 APK.
- `frontend/index.iphone.html` is the iPhone-oriented web entry; it is not an iOS IPA. Host the website over HTTPS and add it to the iPhone home screen, or build a separate native iOS wrapper if an IPA is required.

## 6. Rollback
Keep a backup of the currently deployed frontend/backend and database before release. Roll back the website/backend to the last known-good build if staging checks fail. Do not reverse or rerun database migrations without reviewing their effects.
