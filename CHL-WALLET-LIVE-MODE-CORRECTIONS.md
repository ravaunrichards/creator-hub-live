# Creator Hub Live — Wallet & LIVE Mode Corrections

## Scope
This is a safe, path-preserving source overlay for the identified wallet and LIVE-mode defects. It is **not** a replacement for the full repository and must not be extracted over the entire project as a new project. It leaves unrelated page modules untouched.

## Included source files
- `frontend/src/pages-wallet.js` — keeps all six official coin packages visible with the established target prices: 100/$0.99, 500/$4.99, 1,000/$9.99, 2,500/$24.99, 5,000/$49.99, 10,000/$99.99. Checkout remains disabled until a secure backend quote succeeds; the browser never controls the actual payable amount.
- `android/app/src/main/assets/web/src/pages-wallet.js` — byte-identical wallet UI for Android WebView.
- `backend/src/livekit-token.js` — validates publication according to the selected LIVE mode and grants only mode-appropriate LiveKit publication sources.
- `backend/src/livekit-verification.js` — classifies camera, microphone, screen-share and screen-share-audio tracks; checks the required source for each mode.
- `backend/tests/livekit-contract.js` — regression checks for mode-specific publication requirements.

## LIVE behaviour
- Video LIVE requires camera + microphone.
- Audio LIVE requires microphone only; camera permission is not granted.
- Screen Share LIVE requires a screen-share track; camera/microphone publication is not required. Screen-share audio is allowed when the browser publishes it.

## Installation
Back up the five existing files first. Extract this ZIP into the root of the existing repository, preserving the folder paths, and allow these five files to replace their matching counterparts only. Do not replace the rest of the project with this ZIP.

## Validation performed
- `node --check` passed for the modified frontend and backend modules.
- `node backend/tests/livekit-contract.js` passed.
- `node tests/live-controls-contract.mjs` passed.
- `node tests/wallet-recovery-contract.mjs` passed.
- `npm run check` passed: 396 static integration/contract checks and the associated wallet/LIVE/page contracts.
- `npm run backend:check` passed.
- `npm run backend:test` passed.
- Web and Android wallet files are synchronized byte-for-byte.

## Not performed / important limitations
The GitHub integration rejected branch creation with HTTP 403 (`Resource not accessible by integration`), so no remote source was committed. No Render deployment, Supabase change, Android APK build, or physical-device LIVE test was performed. The exchange rates remain server-configured; this overlay does not invent or alter CHL coin/diamond conversion rates.
