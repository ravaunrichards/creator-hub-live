# KNOWN LIMITATIONS — Creator Hub Live

Date: 2026-10-07. Honest list of what is NOT verified / NOT possible here and
what you must do on a real machine.

## Sandbox could not do these (environment, not code)

1. **No Android SDK / no device** → the hand-forged `creator-hub-live-release.apk`
   was assembled and signed in pure Python, but **install + launch were not
   tested on a real device here**. It is a test-signed sideload build. For a
   Play Store release, build the included Gradle project with **your own
   keystore** in Android Studio.
2. **New signing key** → the APK is signed with a freshly generated key. If you
   previously installed any build of `com.creatorhub.app` signed with a
   different key, **uninstall it first**, otherwise Android rejects the update
   with a signature-mismatch (“App not installed”).
3. **No network / no backend** → Supabase, LiveKit, and PayPal flows were
   verified only by reading code and static logic checks. Live auth, data,
   WebRTC publish/subscribe, and coin purchases are **not runtime-verified**.
4. **No browser** → the blank-screen test uses a Node DOM harness, not a real
   WebView/Chromium. Service-worker runtime caching and real paint behavior are
   **not verified in a browser**.
5. **No camera / no second peer** → live streaming end-to-end is not verifiable.

## Behavioral notes

- **Two Android artifacts, on purpose.** The pure-Python APK is the
  install-now artifact (file-origin WebView). The Gradle project is the
  full-architecture path (WebViewAssetLoader https origin + renderer-crash
  recovery + in-app error page). The https-origin behaviors (secure-context
  APIs) apply to the Gradle build.
- **Backend not configured = expected setup state, not a crash.** With no
  Supabase creds the SPA shows setup/notice states and never blanks. Configure
  `config.js` to enable live features.
- **PayPal stays disabled** (`ENABLE_PAYPAL:false`) until the `paypal` /
  `paypal-webhook` edge functions are deployed.

## Recommended real-environment validation (do on your machine)

1. `cd android && ./gradlew assembleRelease` with your keystore → install on a
   device, confirm no blank screen on cold start, navigation, and app resume.
2. Deploy the Supabase schema + edge functions, set `config.js`, then exercise
   login/register, live room publish/subscribe, and a coin purchase.
3. Kill the renderer (devtools or low-memory) to confirm the crash-recovery
   rebuild repaints instead of going black.
