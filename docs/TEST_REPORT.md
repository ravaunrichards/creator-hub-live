# TEST REPORT — Creator Hub Live

Date: 2026-10-07
Status key: **TESTED/PASS**, **TESTED/FAIL**, **NOT TESTABLE** (sandbox limit).

## Environment limits (honest)

This sandbox has **no Android SDK, no network, no device/emulator, and no
browser/jsdom**. Therefore anything requiring a real browser DOM, a live
Supabase/LiveKit/PayPal backend, Android install, or camera/second peer is
**NOT TESTABLE here** and is marked as such — not claimed as passing.

## 1. JavaScript syntax — TESTED/PASS

`node --check` on every file in `web/*.js`: all pass, 0 syntax errors.

## 2. Blank/black-screen route harness — TESTED/PASS

Custom DOM harness (`mk/test-blank.js`) loads the SPA runtime, registers all
routes, and renders every route, asserting each produces non-empty, non-error
visible content (or an intentional recoverable error card — never a blank body).

| Mode | Routes tested | Passed | Failed |
|------|---------------|--------|--------|
| offline (no backend configured)    | 77 | 77 | 0 |
| configured (backend creds present) | 77 | 77 | 0 |

The earlier 16 `_field is not a function` failures in configured mode were a
**real bug** (undefined `CHL._field` used by auth/settings forms). After adding
the helper to `ui.js` and syncing the canonical source, configured mode is
77/77.

## 3. Duplicate-route check — TESTED/PASS

Static scan + runtime duplicate-route detector: no route registered twice
(previous duplicate `/live` removed).

## 4. APK integrity — TESTED/PASS

- v1 JAR signature (`META-INF/MANIFEST.MF`): present.
- v2 APK Signing Block + v2 scheme id `0x7109871a`: present.
- `AndroidManifest.xml` + `classes.dex`: present.
- Web asset parity: **20/20 files hash-match** (md5) between the canonical
  `web/` source and the APK’s `assets/web/` — web and APK are in sync.

## 5. Secret scan — TESTED/PASS

`web/` scanned for private keys, AWS keys, Supabase service-role keys, and JWTs:
none found.

## 6. NOT TESTABLE in this sandbox (requires real environment)

- APK install + launch on a real Android device/emulator. **NOT TESTABLE** (no
  SDK/device). The Gradle project is the verified full-architecture path; build
  with Android Studio / the included CI to produce a Play-grade signed APK.
- Live Supabase auth/data, LiveKit publish/subscribe, PayPal purchase flow.
  **NOT TESTABLE** (no network/backend). Logic verified statically only.
- Camera/mic capture and multi-peer streaming. **NOT TESTABLE** (no camera /
  second client).
- Service-worker runtime caching behavior in a real browser. **NOT TESTABLE**
  (no browser) — cache version/precache list verified statically.
