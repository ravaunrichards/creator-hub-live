# Creator Hub Creator Network — LIVE repair 4.2.0

This is an update to the existing `ravaunrichards/creator-hub-live` project. It is not a new app and it does not deploy anything.

## Source-level fixes included

- Wires the existing `backend/src/live-room-experience.js` handler into `backend/src/server.js`. Without that connection, nested LIVE routes can fall through to `NOT_FOUND`.
- Removes the unwanted `Run preflight` button and the six reaction counters below the media controls.
- Keeps the host's End LIVE control available after the room can be identified, even if media setup subsequently fails. The server remains responsible for host authorization.
- Adds selectable Speaker focus, Focused guest, Portrait stack, Cinema, and Side-by-side layouts alongside the existing layout choices.
- Adds per-video rotate and expand/restore controls for actual participant video tiles.
- Allows the frontend to load same-origin gift art/animation/audio files rather than rejecting all local asset URLs.
- Replaces the prior short WAV files with conventional 44.1 kHz, 16-bit stereo PCM WAV effects. They are original synthesized sound effects with audible samples—not empty WAV containers or recordings of real-world sounds.
- Bumps the frontend and service-worker cache version and preserves backups of changed files.

## Not claimed as verified

This package cannot supply or invent the production values for `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, Supabase credentials, database permissions, or deployed service URLs. The LIVE room must be installed and tested against the actual configured backend and LiveKit project. This ZIP does not build or sign an APK and does not deploy to GitHub, Supabase, or Render.

The gift and badge SVGs included in the previous package are illustrative vector artwork, not verified photographic assets. This repair does not relabel them as real photographs. Replacing every item with genuine, properly licensed photographic artwork requires a verified source asset for each item.

## Install

1. Extract this ZIP.
2. From the existing repository checkout on branch `main`, run `node ./install-complete-upgrade.mjs /path/to/creator-hub-live`.
3. Review the printed changes and `.pre-chcn-4.2.0-*.bak` backups.
4. Run `npm run check` from the repository root. Do not deploy if checks fail.
5. After manual installation, verify the LIVE room on a real device with configured backend, Supabase, and LiveKit. Test create/start/end, mic, camera, screen sharing, guest invitations, all nested routes, gifts and audio, responsive layouts, and browser console/network errors.
