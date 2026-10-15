# Creator Hub Live — LIVE Room Lifecycle Repair

This is one coordinated, manually installed repair package for the existing Creator Hub Live repository. It does not connect to or modify GitHub, Render, or Supabase by itself.

## What it fixes

- Removes the invalid `created_at` reference from LIVE session cleanup. The deployed `public.live_sessions` schema uses `started_at`, `updated_at`, and `ended_at`; it does not have `created_at`.
- Reconciles only sessions still marked `status = 'live'` and `ended_at IS NULL`.
- Uses only deployed columns (`started_at`, `updated_at`, `ended_at`) and removes the invalid `created_at` reference.
- After the five-minute safety period, keeps rooms with participants live; closes old empty rooms and marks them ended; and marks missing rooms ended.
- Resets `viewer_count` to zero when a session is confirmed ended.
- Treats database and LiveKit errors as unknown states, never as proof that a stream has ended.
- Closes the LiveKit room after an explicit host end succeeds in the database.
- Adds a standalone cleanup job for scheduled execution so cleanup does not depend only on someone opening Explore LIVE.
- Adds regression tests for missing rooms, empty rooms, rooms with participants, transient LiveKit errors, the grace period, and explicit room closure.

## Install into your existing repository

1. Download and extract this ZIP to a folder **outside** your repository.
2. Make a backup of your existing project folder.
3. Run the installer from a terminal, targeting the root of the existing repository:

   ```sh
   node /path/to/extracted-fix/install.mjs --target /path/to/creator-hub-live
   ```

   On Windows, replace the paths with the corresponding Windows paths. The installer checks the expected source anchors before writing, creates a dated `.chl-live-room-backup-*` folder inside the repository, installs the lifecycle modules and regression tests, and updates `backend/src/server.js` and `backend/package.json`. It stops without changing repository files if the expected current source structure is not found.

4. From the repository's `backend` folder, run:

   ```sh
   node --check src/server.js
   node --check src/live-room-lifecycle.js
   node --check src/cleanup-live-rooms.js
   npm run test:live-room-lifecycle
   npm test
   ```

5. Review the changes and test output locally. The installer does not commit, push, deploy, change cloud settings, or write to Supabase.

## Make cleanup run automatically

The new script must be run periodically as a scheduled job. Create a scheduled job from the same repository with:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `node src/cleanup-live-rooms.js`
- Schedule: `*/5 * * * *`

Configure these environment variables on the scheduled job using the same existing values as the backend service:

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Do not put secret values in the repository or this ZIP. The cleanup job is read/write by design only for `live_sessions` status fields; it never deletes database records. The script itself does not create the scheduled job or deploy anything.

## Important safety note

This package intentionally does not treat `viewer_count = 0` as proof that the host ended a stream. It also does not mark a room ended when LiveKit cannot be reached. After installation and tests, the existing stale rows may need one-time reconciliation; this package does not change your live database until you install and run the scheduled job.
