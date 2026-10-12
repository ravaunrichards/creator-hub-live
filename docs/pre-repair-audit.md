# Creator Hub Creator Network — Pre-Repair Audit

## Snapshot identity

- Source snapshot: `creator-hub-live-main.zip`
- Git metadata: **not present** (`.git/` was absent from the supplied archive)
- Branch/HEAD/remote: **UNAVAILABLE from the supplied archive**
- Original file count: **80**
- Top-level directories: `android/`, `backend/`, `database/`, `docs/`, `frontend/`, `releases/`, `tests/`

## Architecture observed

- Frontend: browser/PWA JavaScript application under `frontend/`
- Android: native WebView wrapper under `android/`
- Backend: Node HTTP server under `backend/src/server.js`
- Database: ordered SQL migrations `0001`–`0008`
- LiveKit: server-side token utility plus browser client
- Payments: PayPal server integration plus wallet/ledger SQL
- Existing release APKs: two identical APK files under `releases/`

## Pre-repair failures reproduced by source tests

The original `npm run check` reported **68 passed / 9 failed**. The failures were:

1. Missing `backups/` directory required by the original integration checker.
2. Missing `backend/.env.example`.
3. Missing root `.gitignore`.
4. `core.js` differed between frontend and Android packaged web.
5. `livekit.js` differed between frontend and Android packaged web.
6. `pages-room.js` differed between frontend and Android packaged web.
7. `index.html` differed between frontend and Android packaged web.
8. `config.js` differed between frontend and Android packaged web.
9. Frontend secret scan matched the literal `LIVEKIT_API_SECRET` text in the browser source.

Additional source inspection found functional/security defects not fully covered by that checker:

- Backend had a hard-coded LiveKit WebSocket fallback.
- LIVE start changed the database state to `live` without calling `verifyHostPublishing()`.
- `verifyHostPublishing()` accepted any single unmuted track instead of independently requiring camera and microphone.
- Frontend LIVE flow used the database room ID as the LiveKit room name instead of consuming the backend `room_name`.
- Android had no `WebChromeClient.onShowFileChooser()` implementation.
- Android permission callback granted all requested media resources when **any** permission was granted.
- Android and frontend configuration pointed at different Supabase and LiveKit projects.
- Android release signing passwords were hard-coded in `android/app/build.gradle`; debug builds reused the release key.
- Wallet frontend called endpoints that were not present in the backend.
- LIVE chat called an endpoint that was not present in the backend.
- Settings pages contained non-persistent placeholder behavior and an example PayPal account mask.
- Existing database migration history did not contain `updated_at` for `live_sessions` although backend code wrote it.

## Release/signing findings

The supplied APKs were byte-for-byte identical with SHA-256:

`b061a97bced2b20d5115fe5bf93b780f30e37d37d8d5bc59a944b9a706e29a0a`

Their certificate SHA-256 was:

`1D:DE:83:C9:77:CE:3A:D7:E7:EE:FF:DA:7C:AD:B0:B0:80:E4:33:CD:0F:11:14:89:A8:34:E1:91:41:EA:FE:46`

The repository keystore certificate SHA-256 was different:

`B6:84:18:EC:AE:2F:31:EA:25:11:AF:55:C9:E6:01:5B:69:2A:1F:04:D0:E3:ED:88:8C:2C:D3:BB:E7:DB:03:4C`

Therefore the supplied APKs were **not** treated as the current release build.

## Environment limitations

The archive did not include:

- `.git/`
- Gradle wrapper (`android/gradlew`)
- Gradle wrapper directory/JAR
- Android SDK/build tools
- `adb`/device/emulator
- installed Node dependency tree (`node_modules/`)
- live Supabase credentials
- live LiveKit credentials/network
- PayPal credentials/network
- deployment credentials

These limitations prevent truthful runtime/build PASS claims.
