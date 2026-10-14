# Change Log — 2026-10-10

Based on inspection of the supplied `creator-hub-live-main.zip`.

## Backend / LIVE

- Token endpoint now validates the authoritative database room name and rejects ended rooms.
- Viewers cannot obtain a LiveKit token for a pending room; the host may connect to publish.
- LIVE start updates are conditional on the row still being `pending` or `live`, preventing an ended session from being restarted by a stale request.
- Request body parsing is capped at 1 MiB while continuing to drain oversized requests.
- Added `/api/leagues/standings`, returning the active season's real database standings or an empty list when no active season exists.

## Wallet / PayPal

- Fixed the backend/schema mismatch: the schema has `coin_packages.price` and `currency`, not `price_usd`.
- Added an authenticated `/api/wallet/packages` catalog endpoint; the frontend now displays current active USD package prices from the database instead of a hardcoded price list.
- Added PayPal approval URL validation and included `approveUrl` in order-creation responses.
- Corrected the PayPal return URL to match the frontend's `paypal=success` handler.
- PayPal capture and verified capture webhooks now verify the stored order ID, captured amount, and currency before crediting the wallet.
- Capture calls use a capture-specific PayPal idempotency request ID.
- Successful capture responses now include `credited: true`, matching the frontend contract.

## Database / tests / security

- Fixed invalid `wallets.user_id uuid key` syntax to `uuid primary key`.
- Added the `lifetime_gifts_sent` wallet column required by server code and the gift RPC.
- Made coin-package seeding rerunnable and added migration `0013_wallet_package_contracts.sql` to reconcile wallet fields and remove duplicate active packages before adding a unique active package index.
- Updated LiveKit contract tests to check the numeric TrackSource enum values used by `livekit-server-sdk` v2.19.1 (`CAMERA=1`, `MICROPHONE=2`) rather than incorrectly expecting strings in source.
- Updated cross-layer contract tests and added a repository-wide secret hygiene check.
- Replaced private-looking values in `backend/.env.example` with placeholders.
- Added the Android WebView origin to setup guidance and normalized CORS origins.
- Synced `frontend/` web assets into the Android packaged web tree.
- Excluded the supplied signing keystore and APK artifacts from the corrected source ZIP.

## Not changed / not claimed

- No external provider credentials were rotated by this package.
- No database migrations were applied to the actual Supabase project.
- No Android APK was built or installed.
- Multi-guest controls and switchable LIVE layouts 1–4 remain unimplemented.
