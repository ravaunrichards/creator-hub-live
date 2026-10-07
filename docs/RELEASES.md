# Creator Hub Live — Release History

## v3.2.0 (Merged Release)

This is the merged release combining VERSION_A (backend + database) and VERSION_B (hardened frontend v3.2.0 + Android APK).

### Frontend v3.2.0 Bug Fixes (from VERSION_B)

| Fix | File | Description |
|---|---|---|
| ui.field helper added | `ui.js` | `CHL._field` / `ui.field` was used by `pages-auth.js` and `pages-settings.js` but was never defined — REAL BUG causing runtime errors on forms |
| Duplicate /live route removed | `pages.js` | `/live` route was registered in both `pages.js` and `pages-room.js`, causing silent overwrite |
| roomHostId scope fix | `pages-room.js` | `roomHostId` variable moved to module scope to avoid reference errors |
| Error boundaries | `core.js` | `renderRecoverableError()` added; duplicate route detection; global `error` / `unhandledrejection` guards |
| Backend state machine | `core.js` | `requireSupabase()`, `requireAuth()`, `safeBackendCall()`, `diagnostics()` helpers for graceful degradation when backend is misconfigured |
| Early HTML guard | `index.html` | Inline script detects missing config and shows user-friendly error before SPA loads |
| SW cache bump | `sw.js` | Cache version bumped to `chl-web-v3-2-0`; resilient per-asset install (one failure doesn't break the whole cache) |

### Backend (from VERSION_A)

- Full Express-style HTTP server with LiveKit, PayPal, wallet, and league routes
- LiveKit token minting server-side (never exposes API secrets to browser)
- PayPal order creation, capture, webhook verification, and refund
- Server-authoritative wallet ledger (`credit_coins`, `debit_coins`, `send_gift` RPCs)
- Server-authoritative league system (match results, standings, promotion/relegation via RPCs)
- Idempotent payment handling with unique constraint on `(user_id, idempotency_key)`

### Database Migrations (8 files)

| Migration | Scope |
|---|---|
| 0001 | Identity, profiles, social graph |
| 0002 | Content, interactions, messaging, notifications |
| 0003 | Wallet, PayPal payments, gifts, diamonds |
| 0004 | Live sessions, guests, matches, taps, teams, leagues, rankings, subscriptions, admin audit |
| 0005 | Row Level Security (default-deny) |
| 0006 | Seed config (leagues, coin packages, gift catalog — NO fake users) |
| 0007 | Payment idempotency (unique index on `user_id + idempotency_key`) |
| 0008 | Server-authoritative leagues (promotion/relegation, standings rebuild) |

### Android

- WebView wrapper with `WebViewAssetLoader` serving bundled web assets
- `release.keystore` is a development placeholder — **replace before production signing**

### Included Files

- `releases/creator-hub-live-release.apk` — pre-built APK (45 KB, unsigned/placeholder)
- `docs/BUILD_REPORT.md` — build process report
- `docs/TEST_REPORT.md` — test results
- `docs/KNOWN_LIMITATIONS.md` — current limitations