# BUILD REPORT — Creator Hub Live

Date: 2026-10-07
App identity: `com.creatorhub.app` — label “Creator Hub Live” (unchanged)
Web bundle version: `3.2.0` / service-worker cache `chl-web-v3-2-0`

## What was built

1. **Canonical web SPA** (`creator-hub-live-final/web/`, 20 files) — the single
   source of truth. All page/runtime hardening lives here and nowhere else.
2. **Hand-forged installable APK** (`creator-hub-live-release.apk`, 45,198 bytes,
   25 zip entries) — built in pure Python (no Android SDK / no network available
   in this sandbox). Signed v1 (JAR) + v2 (APK Signature Scheme). Bundles the
   exact canonical web source as `assets/web/`.
3. **Buildable Gradle/androidx project** (`creator-hub-live-final/android/`) —
   the full-architecture path (WebViewAssetLoader https origin, renderer-crash
   recovery, in-app error page, runtime camera/mic permissions). Build with
   `./gradlew assembleRelease` or the included GitHub Actions “Build APK” / Docker
   path on a machine with the Android SDK.

## Resilience work applied to the web SPA (blank/black-screen defense)

- `core.js`: error boundary inside `CHL.render` so a thrown page renders a
  visible recoverable error card instead of a blank body; global `error` and
  `unhandledrejection` guards; backend state machine
  (`requireSupabase` / `requireAuth` / `backendStatus` / `safeBackendCall` /
  `diagnostics`); duplicate-route detector; `renderRecoverableError`.
- `index.html`: early inline guard that paints a fallback before the bundle
  loads; fixed a literal `\u2014` artifact.
- `ui.js`: added the missing `CHL._field` / `ui.field` helper. **Real bug** — it
  was used by `pages-auth.js` (login/register) and `pages-settings.js` but never
  defined, so those forms crashed once a backend was configured.
- `pages.js`: removed the duplicate `/live` route (kept the server-authoritative
  one in `pages-room.js`).
- `pages-room.js`: fixed `roomHostId` scope bug.
- `sw.js`: cache bumped to `chl-web-v3-2-0`; resilient per-asset install so one
  failed precache entry no longer aborts the whole service-worker install.
- `config.js`: version `3.2.0`.

## Android hardening (Gradle project `MainActivity.java`)

- Serves assets over `https://appassets.androidplatform.net/assets/web/` via
  `WebViewAssetLoader` (secure https origin → localStorage / SW / getUserMedia
  behave as on the real site).
- `onRenderProcessGone`: destroys the dead WebView and rebuilds a fresh one →
  renderer crash never leaves a black screen.
- `onReceivedError` (main frame only): paints a visible, recoverable in-app
  error page with a Retry button; subresource errors do NOT blank the app.
- `shouldOverrideUrlLoading`: internal nav stays in-app, external links / mailto
  / tel open via the system, unknown schemes fail safe.
- Runtime camera/mic permission flow for LiveKit; `allowFileAccess`/
  `allowContentAccess` disabled (not needed with the asset loader).

## Build commands

- Hand-forged APK: `python mk/apkbuild.py` → `creator-hub-live-release.apk`.
- Gradle APK (needs Android SDK): `cd android && ./gradlew assembleRelease`.

## Verification summary (details in TEST_REPORT.md)

- All web JS passes `node --check`. ✅
- Blank-screen route harness: 77/77 routes PASS in both offline and configured
  modes. ✅
- APK: v1 + v2 signatures present, 20/20 web assets hash-match canonical web. ✅
- Secret scan of `web/`: no secrets. ✅
- No duplicate routes. ✅
