# Source audit — Creator Hub Creator Network (2026-10-13)

Repository: `ravaunrichards/creator-hub-live`, branch `main`.

## Confirmed source-level defects

1. `backend/src/live-room-experience.js` exports `handleLiveRoomExperience`, with routes for LIVE guests, reactions, polls, questions, moderators, analytics, recordings, settings, and schedules. The current `backend/src/server.js` neither imports nor calls this handler. Requests for these resources can fall through to the generic `{ code: "NOT_FOUND" }` response.
2. `frontend/src/pages-room.js` creates six visible reaction-counter buttons and a `✓ Run preflight` button. These are the unwanted controls described by the owner.
3. `frontend/styles/app.css` defines a grid for the gift gallery, but no explicit hidden-state rule exists. An author grid style can override the browser's default `[hidden]` behavior.
4. `github/workflows/creator-hub-android.yml` is not at GitHub Actions' recognized `.github/workflows/` path. The existing workflow therefore is not discoverable as an Actions workflow at that location.
5. The root `npm run check` does not include `tests/live-room-upgrade-contract.mjs`, so its contract expectations are not part of the normal check command.
6. `frontend/index.html` loads the old script modules but does not load `frontend/src/pages-project-upgrade.js`. That file calls extra routes such as `guest-requests` and `gift-events`; those are not implemented by the current `live-room-experience.js` route matcher. The repair package intentionally does **not** enable that upgrade module prematurely.
7. The `/api/gifts` endpoint currently selects only basic gift fields even though the actual Supabase schema has `graphic_url`, `animation_url`, `sound_url`, `category`, `emoji`, and `catalog_order`. The gift tile is implemented as a real HTML button, but the API omits the media metadata, and the UI rejects same-origin `/assets/gifts/...` paths. This explains why a gift can look like an image/emoji tile without its intended project artwork being used.

## Verified operational context

- Render lists the frontend static site and backend web service as live. The backend log reports that the server starts on port 10000. This verifies process startup only, not endpoint correctness.
- Frontend config points to the listed Render backend URL and the existing Supabase project.
- A read-only Supabase query found 96 gift rows, 90 active rows, and zero rows with non-empty `graphic_url`, `animation_url`, or `sound_url`. The 90 active gift names can be used to derive asset filenames, but only 42 art SVGs and 52 animation SVGs exist in the repository (48 art and 38 animation files are missing for the 90 active names); all 90 sound filenames exist and have distinct Git blob hashes. Missing art/animation files must not be replaced with fabricated assets; the UI should use the actual database emoji and label as fallback.
- The applied Supabase migration history includes `0027_live_room_experience` but does **not** include `0029_complete_social_live_gifting`. That migration creates `live_room_guest_requests` and has a strict preflight for the approved 90 gift rows. Because the database has 96 total gift rows, its preflight must be reviewed before application. No migration was applied by this audit.

## Not verified

- Live browser/API request results (the web fetch path was unavailable in this session).
- Full `npm run check`, live Supabase RLS/table-column compatibility, real LiveKit media, PayPal transactions, physical Android behavior, signed production APK output, or responsive screenshots.
- The existing codebase has not been migrated to React/Vite. A full framework migration is not included because it would be a broad rewrite and should not precede fixing route wiring and regression coverage.
