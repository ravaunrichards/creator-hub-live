# LIVE Room Upgrade — Install, Configure, Test

This document is copied by the installer to `docs/LIVE-ROOM-UPGRADE-INSTALL.md` in the existing Creator Hub repository.

## Apply the update

- Make a full backup and work in a local checkout of the existing `ravaunrichards/creator-hub-live` repository on the intended branch. No GitHub edits or deployment are performed by this package. The installer patches `frontend/src/pages.js` so home/discovery use the backend's audience-filtered list rather than directly querying follower-only/private sessions. It also bumps `frontend/index.html`, `frontend/sw.js`, and the root package to 4.0.3 to prevent stale PWA scripts.
- Run `node ./install-live-room-upgrade.mjs /path/to/creator-hub-live` (Windows: `node .\install-live-room-upgrade.mjs "C:\path\to\creator-hub-live"`).
- Review the timestamped `.pre-live-room-*.bak` files and `git diff --check`; compare the output against the feature requirements before committing manually.
- Carefully review then manually apply `database/migrations/0026_live_room_experience.sql` to the intended Supabase project after database backup. The installer never submits SQL to Supabase.

## Checks before deploy

Run from the repository root:

```bash
node --check frontend/src/pages-room.js
node --check backend/src/server.js
node --check backend/src/livekit-token.js
node --check backend/src/live-room-experience.js
node --check scripts/cleanup-live-recordings.mjs
npm run live-room:check
npm run check
```

The new static contract test checks route wiring, key controls, room audience/token/chat policy, private-table/RLS contract, retention/download markers, ordered approved gift catalogue, and the existing 90-gift migration. It does not make authenticated requests and cannot verify database policy behavior or the browser layout.

## Recordings and storage

Recordings require LiveKit Egress and a private S3-compatible bucket. Configure backend-only environment variables:

- `LIVE_RECORDING_S3_BUCKET`
- `LIVE_RECORDING_S3_REGION` (or `AWS_REGION`)
- `LIVE_RECORDING_S3_ACCESS_KEY` (or `AWS_ACCESS_KEY_ID`)
- `LIVE_RECORDING_S3_SECRET_KEY` (or `AWS_SECRET_ACCESS_KEY`)
- Optional `LIVE_RECORDING_S3_ENDPOINT`
- Optional `LIVE_RECORDING_S3_FORCE_PATH_STYLE=true`
- `LIVE_RECORDING_CLEANUP_SECRET` (long random value)

Use least-privilege storage credentials and keep the bucket private. The backend creates five-minute signed download URLs for the owner; they are not a substitute for bucket privacy. Validate upload and download behavior against your actual provider. With missing settings, recording requests return a configuration error instead of claiming a recording exists.

Configure a daily cron job in your hosting provider to run `node scripts/cleanup-live-recordings.mjs`, with `BACKEND_URL` set to the backend service base URL and `LIVE_RECORDING_CLEANUP_SECRET` matching the backend. This package cannot configure a hosted cron service automatically. The endpoint deletes eligible `ready` and `failed` recordings whose `expires_at` is reached and returns per-object failures so failed deletion is visible.

## Manual end-to-end tests

1. Test a host and viewer account, then a guest account that accepts an invitation. Verify that host and accepted guest can publish, while ordinary viewers cannot. Test public, follower-only, and private access.
2. Verify camera/microphone denial, reconnect status, mic/camera toggle, screenshare, remote track placement, end-live confirmation, and clean disconnect.
3. Inspect the real gift API response and verify names, prices and optional graphic/animation/sound URLs match `public.gifts`; configure valid HTTPS `sound_url` values when matching gift sounds are available; the UI will not invent a sound for a gift with no sound asset. Check wallet and `gift_transactions` before and after sending gifts.
4. Test guest invite by username and account ID, accept/decline/leave/remove, mute and camera controls, moderator appointment by username/account ID, chat reports, reactions, polls, Q&A, and real-score battle start/end.
5. Confirm the schedule writes to existing `live_schedules` and that its existing database notification trigger generates in-app reminders; never interpret an inserted schedule as an automatically started broadcast.
6. Test analytics against real chat, accepted-guest and gift-ledger rows. Ensure no synthetic viewers or counters appear.
7. Test Egress recording start/stop, object upload, owner-only listing/download/delete, expired signed URL, and daily cleanup. If any prerequisite fails, recording must show an error or pending status without a false success.
8. Test 320 px, 360 px and 390 px phone widths, tablet at 768 px, and desktop. Check text wrapping, no sideways scroll, keyboard-safe chat, small independent chat panel, large stage, touch targets, reduced motion, and gift sounds.

A passing syntax/static test is not a production acceptance pass. Complete these tests in a staging environment with real configuration before promoting the update.
