# Creator Hub Live — abandoned LIVE session repair

## Files included

Replace/add only these repository-relative files:

- `backend/src/server.js` — ends explicit LIVE sessions in the database and closes the LiveKit room; starts a guarded reconciliation loop in the existing backend.
- `backend/src/live-room-lifecycle.js` — checks stale LIVE sessions against LiveKit host presence and marks abandoned sessions ended.
- `backend/package.json` — includes lifecycle checks in the backend test commands.
- `backend/tests/live-room-lifecycle.test.js` — regression tests for connected hosts, missing hosts/rooms, fresh sessions, and uncertain LiveKit responses.

No frontend or Android files need replacing: their live listings already filter for `status = live` and `ended_at IS NULL`, and they read the same database state. Once the backend marks a stale session ended, it disappears from all those listings on their next refresh.

## Install

1. Back up the four existing files listed above if they exist.
2. Extract this ZIP at the repository root, preserving the folder paths, and allow the included files to replace/add those exact paths.
3. Run from the repository root:

   ```sh
   cd backend
   npm run check
   npm test
   ```

4. Commit and push the changes using your normal manual workflow so the existing Render backend deploys the updated code.

## Expected behavior

- Pressing **End LIVE** marks the session ended, sets its viewer count to zero, and attempts to close the LiveKit room.
- If the host disappears without ending the session, the backend reconciliation loop checks stale sessions every 60 seconds. After the two-minute stale window, it confirms whether the host is still present before marking the session ended. A LiveKit/network error is treated as unknown and does not end a session.
- Active rooms whose host is confirmed present get their server-side heartbeat refreshed and remain live.

## Scope and verification

This ZIP does not modify GitHub, Supabase, Render, or the deployed site. It does not change database schema or delete chat history. Local tests verify the lifecycle logic; the deployed behavior still needs verification after you install and the backend deploy completes.
