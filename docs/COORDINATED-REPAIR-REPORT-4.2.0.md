# Coordinated repair report — 4.2.0

## Source basis
Built from the saved Creator Hub Creator Network full website release 4.0.0 plus the existing `creator-hub-live-main(1).zip` Android wrapper and release artifacts. The approved 4.0.2 rollback backup is not overwritten.

## Changes made in this source package
- Added forward migration `0025_live_guest_request_workflow.sql` for explicit pending guest requests.
- Added authenticated server routes to list guest requests, request a stage slot, approve/reject requests, and remove/leave stage.
- Changed LiveKit publishing authorization so the host and host-approved guests may publish; only the host can start/end the broadcast.
- Changed gift tiles from clickable `div[role=button]` elements to actual keyboard-accessible `button` elements.
- Extended `/api/gifts` responses with existing schema-backed category and art URL fields; no fake gift images or prices are created.
- Added responsive LIVE layout rules, explicit `[hidden]` behavior, cache invalidation, a regression contract, and an iPhone-friendly PWA entry file.
- Synchronized `frontend/` into the Android WebView asset directory.

## Validation required
Run `npm run check` and backend tests in a Node 20+ environment. Then test against staging with real Supabase migrations, authenticated host/guest accounts, LiveKit credentials, and actual camera/microphone devices. Production runtime verification has not been performed here. Existing APK artifacts are preserved but are not rebuilt or represented as newly signed.
