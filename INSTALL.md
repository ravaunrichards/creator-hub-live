# Creator Hub Creator Network — LIVE Room Upgrade

This is an **upgrade for the existing** `ravaunrichards/creator-hub-live` repository. It is not a new project and does not push a commit, deploy services, or edit GitHub. Run the installer against a local checkout of the existing repository. It creates timestamped backups of the existing files it replaces and refuses to overwrite pre-existing new-file destinations.

## Contents

- Responsive LIVE room replacement with compact/balanced/spacious/grid layouts, large mobile stage, smaller independently scrolling chat, media controls, pre-live checks, room details, profiles, gift UI/audio/reduced-motion preferences, reactions, guests, battles, polls, Q&A, moderators, analytics, audience settings, cover image, schedules and reminders, and recordings UI.
- Backend routes that use the existing LiveKit, Supabase profiles, `live_guests`, `matches`, `match_participants`, gift transaction ledger, notifications, `live_schedules`, and existing wallet gift endpoint. Home/discovery also switches to the audience-filtered room list so follower-only/private streams are not exposed by the previous direct query.
- Additive migration `database/migrations/0026_live_room_experience.sql` for audience/guest settings and private room feature tables with RLS enabled.
- LiveKit Egress recording service and private S3-compatible recording storage integration, signed short-lived downloads, owner-only deletion, and a cleanup endpoint for recordings eligible for 30-day retention.
- A cleanup script, static contract test, and installation/staging checklist.

The upgrade does not seed demo activity or rewrite the approved 90-gift catalogue. Existing gift IDs, prices, transaction history, and artwork fields are preserved. If the database contains no usable gift artwork URL, the LIVE UI uses a simple icon fallback; it does not fabricate an image URL.

## Install into an existing checkout

1. Download and extract the ZIP.
2. Back up the entire existing project and confirm it is the intended repository/branch (`main`). Keep your production branch untouched while reviewing.
3. Run the installer with a path to the local checkout:

   **Windows (PowerShell):**

   ```powershell
   node .\install-live-room-upgrade.mjs "C:\path\to\creator-hub-live"
   ```

   **macOS/Linux:**

   ```bash
   node ./install-live-room-upgrade.mjs /path/to/creator-hub-live
   ```

4. The installer checks all existing source anchors before writing. It also keeps private/follower room checks in room-list, room-detail, LiveKit-token, and chat endpoints, and stops an active recording before ending LIVE. It replaces `frontend/src/pages-room.js`, updates `frontend/index.html` and `frontend/sw.js` to release/cache version 4.0.3, updates `backend/src/server.js`, `backend/src/livekit-token.js`, and `package.json`, and adds the migration, backend module, cleanup task, tests, and this guide. Timestamped `.pre-live-room-*.bak` copies are written beside each replaced file. If the installed repository differs from the expected contract, the installer stops instead of guessing. Do not manually bypass that preflight.
5. Review the generated diff and backups. Run the checks below **before deploying**. Version 4.0.3 bumps the service-worker cache and script URLs so the replaced LIVE page is not stuck behind the old 4.0.2 shell cache.

## Supabase migration — manual step

The installer deliberately does not run SQL against your project. Back up the intended Supabase database first. Review and manually run `database/migrations/0026_live_room_experience.sql` in that same project’s SQL editor, after the existing earlier migrations are confirmed. Check the SQL execution result; do not deploy the backend/UI until it succeeded. This migration is additive and creates the tables required by the new buttons/routes. Do not rerun if your environment already has an equivalent migration; inspect the schema and reconcile instead.

## Validation commands

From the existing repository root after installation:

```bash
node --check frontend/src/pages-room.js
node --check backend/src/server.js
node --check backend/src/livekit-token.js
node --check backend/src/live-room-experience.js
node --check scripts/cleanup-live-recordings.mjs
npm run live-room:check
npm run check
```

`npm run check` is the existing project suite plus the new static LIVE contract test. Static checks are not a substitute for signing in and testing with a real LiveKit/Supabase staging environment. Read the staging checklist in `docs/LIVE-ROOM-UPGRADE-INSTALL.md`.

## Recording prerequisites

Recording stays explicitly unavailable until configured. The backend uses LiveKit Egress and a private S3-compatible bucket. Configure these variables on the backend service (never in frontend `config.js`):

- `LIVE_RECORDING_S3_BUCKET`
- `LIVE_RECORDING_S3_REGION` (or `AWS_REGION`)
- `LIVE_RECORDING_S3_ACCESS_KEY` (or `AWS_ACCESS_KEY_ID`)
- `LIVE_RECORDING_S3_SECRET_KEY` (or `AWS_SECRET_ACCESS_KEY`)
- Optional `LIVE_RECORDING_S3_ENDPOINT` for a compatible storage provider
- Optional `LIVE_RECORDING_S3_FORCE_PATH_STYLE=true` when required by the provider
- `LIVE_RECORDING_CLEANUP_SECRET` — a long random secret shared only by the backend and cleanup job

Also confirm that LiveKit Egress is enabled and can reach/upload to the private bucket. Grant the Egress credentials the minimum required write access; grant the backend storage credentials only the required object HEAD/GET/DELETE permissions. Keep the bucket private and do not add public-read access. Downloads use a short-lived signed URL rather than a public object URL. Credentials are never stored in this ZIP.

To enforce 30-day retention, configure a **daily** cron job in your existing hosting provider to run `node scripts/cleanup-live-recordings.mjs`, with `BACKEND_URL` set to the backend service base URL and the same `LIVE_RECORDING_CLEANUP_SECRET`. The ZIP includes the job script and API endpoint; it cannot create a hosted cron job on your behalf. Confirm a successful cleanup result before calling automatic retention enabled.

## Release and staging acceptance checklist

- Start a host stream; verify camera/mic permission failure is handled; confirm the backend only marks the stream LIVE after publication verification.
- Join as a viewer, accepted guest, follower-only viewer, and non-follower. Verify audience access and that only the host/accepted guests can publish media.
- Invite a guest and verify the in-app notification opens the correct LIVE room; accept/decline and test mute/camera/remove/leave on the real LiveKit room; ensure audience viewers do not get guest video tiles.
- Send existing gifts at real database prices, including to an eligible guest; verify the sender balance, recipient diamonds, transaction record, idempotency, rejection for self-gifting/insufficient funds, and no UI “success” before server confirmation.
- Verify every active gift and its actual `graphic_url`/`animation_url`/`sound_url` if the database has one, all 90 approved gift prices remain unchanged, and sound/reduced-motion controls work.
- Run/close a battle and verify scores derive from real gift transaction rows whose timestamps fall within the battle window.
- Create/vote/close polls, submit/pin/answer questions, appoint/remove moderators, report/delete chat messages, and check that the UI reflects saved state.
- Verify host analytics display real saved chat/guest/gift records and current connected viewers (or clearly show when unavailable); check schedule creation/cancellation and actual in-app follower notification trigger.
- With Egress and private storage configured, start, stop, refresh, download/save, manually delete, and clean up a real recording. Verify the signed download expires, object is inaccessible anonymously, and the cleanup job removes only eligible expired objects. Confirm the UI reports missing configuration instead of simulating a recording.
- Test 320/360/390 px Android widths, 768 px tablet, and desktop; confirm the video remains prominent on mobile, chat is compact and independently scrollable, all buttons are reachable, the on-screen keyboard does not hide chat send, and no horizontal page scroll/overlap occurs.
- Verify no new database migration was applied to production by this ZIP itself. Only apply reviewed SQL and deploy after staging passes.

## Honest test boundary

This deliverable contains code, a deterministic installer, a static contract test, and the manual/provider checklist. This environment can run syntax/static/installer tests, but it does not have your live Supabase database, signed-in accounts, LiveKit deployment, private storage credentials, or your phone to prove full production behavior. Do not interpret a passing static check as an end-to-end production pass.
