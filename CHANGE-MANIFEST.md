# Creator Hub Live — Coordinated Test Bundle

**Source of truth:** `ravaunrichards/creator-hub-live`, branch `main`, commit `2e09321272f2c0f40552085281dd30b153898897` (tree `57aeeaa46ccacde947b28e4f16279c3d974c4b0f`, observed 2026-10-16).

This ZIP is a replacement-file bundle, **not a full project archive**. Extract it at the repository root and replace only the files at the paths listed below. Keep a backup or commit your current state first.

## Included source replacements

| Destination path | Why it is included |
|---|---|
| `backend/.env.example` | Replaces exposed-looking private example credentials with obvious placeholders. Do not copy this template over the actual deployment environment. |
| `backend/src/server.js` | Connects the already-existing `backend/src/teams-routes.js` module to HTTP routing; adds server-authoritative media-mode publishing and room-audience enforcement; restricts public LIVE discovery; quotes custom coin quantities server-side; fixes PayPal return URL/hash routing. |
| `backend/src/livekit-token.js` | Gives Video LIVE camera+microphone and preserves its existing in-room screen-share control; Audio LIVE receives microphone-only publish permission; Screen-Sharing LIVE receives screen-only permission for its host. |
| `backend/src/livekit-verification.js` | Distinguishes camera, microphone, screen-share video and screen-share audio tracks for LIVE start validation. |
| `backend/tests/livekit-contract.js` | Covers screen-share source types, required media, and mode-specific permissions. |
| `backend/tests/route-check.js` | Adds checks for the Teams API dispatch and custom coin-quote endpoint. |
| `database/migrations/0028_live_modes_appearance.sql` | Forward migration for the media-mode field, LIVE audience constraints, requested guest-request state/timestamps, and stored appearance preferences. See the migration caution in `TEST-RESULTS.md` before applying it. |
| `frontend/src/core.js` | Adds a single controlled access-token refresh/retry when an authenticated request returns HTTP 401; does not weaken backend authorization. |
| `frontend/src/livekit.js` | Updates LIVE participant join/exit labels to use public names rather than internal database IDs. |
| `frontend/src/pages-auth.js` | Provides a polished responsive login page and two-step signup using the existing `username` and `display_name` auth metadata contract. |
| `frontend/src/pages-creator.js` | Restores/expands Creator Analytics using real account, content, LIVE and available wallet/gift records; reports unavailable history rather than fabricating analytics. |
| `frontend/src/pages-room.js` | Adds Audio-Only LIVE presentation, dedicated screen-only start-after-user-gesture flow, shareable room links, mode-aware controls, and public participant labels. Preserves screen sharing within ordinary Video LIVE. |
| `frontend/src/pages-settings.js` | Preserves the current appearance selection when unrelated privacy, notification or LIVE settings are saved. |
| `frontend/src/pages-wallet.js` | Adds server-quoted custom coin quantities, dynamic preset quotes, three media-mode choices and Public/Followers/Private LIVE audience selection. Checkout still submits quantity only. |
| `frontend/src/style-system.js` | Adds persistent selectable themes, current/classic and alternate layouts, fonts, text scales and accent colors with account syncing where available. |
| `package.json` | Adds the new platform contract test to `npm run check`. |
| `tests/live-room-entertainment-contract.mjs` | Updates LIVE contract coverage to the mode-aware track permissions. |
| `tests/repair-contract.js` | Updates existing repair checks to the mode-aware publishing permissions. |
| `tests/platform-upgrade-contract.mjs` | Adds static contract checks for routing, media modes, privacy, coin pricing, PayPal callback routing, signup, appearance, migration and credentials template. |

## Android WebView source mirrors

These files mirror the matching frontend source replacements byte-for-byte. They update the web application code packaged by Android; **this ZIP does not contain or build an APK**.

- `android/app/src/main/assets/web/src/core.js`
- `android/app/src/main/assets/web/src/livekit.js`
- `android/app/src/main/assets/web/src/pages-auth.js`
- `android/app/src/main/assets/web/src/pages-creator.js`
- `android/app/src/main/assets/web/src/pages-room.js`
- `android/app/src/main/assets/web/src/pages-settings.js`
- `android/app/src/main/assets/web/src/pages-wallet.js`
- `android/app/src/main/assets/web/src/style-system.js`

## Intentionally not replaced

- `backend/src/teams-routes.js`: this module already exists on the specified latest `main`; `server.js` is wired to it. Keep it present.
- `backend/src/gift-asset-manifest.json`, `docs/gift-asset-manifest.json`, gift artwork, animations and sound files: unchanged intentionally to preserve the authoritative 90-gift catalogue and all existing mappings.
- Main HTML/service-worker files: unchanged; the existing service worker uses network-first behavior for application JavaScript.
- Production configuration, database records, GitHub and live provider settings: untouched.
