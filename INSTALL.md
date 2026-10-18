# Creator Hub Live — LIVE Analytics separation correction

## Purpose
Remove the per-stream LIVE session list from Creator Analytics entirely. The current page fetches `live_sessions.title` and renders each title (for example, short titles like “hi”) under LIVE analytics. This correction keeps aggregate session/audience/duration metrics, but the Analytics page no longer requests or displays session titles.

## What this changes
- `frontend/src/pages-creator.js`
- `android/app/src/main/assets/web/src/pages-creator.js`

For each file, the guarded updater removes `title` from the Analytics-only `live_sessions` select and removes the whole per-session title/date/status list from the LIVE Analytics card. It leaves aggregate counts and metrics intact.

## What it does NOT change
- It does not delete stream titles from `live_sessions`.
- It does not change the title field used by the LIVE broadcast, recordings/history, or other legitimate LIVE features.
- It does not delete or modify `live_chat_messages` or any chat history.
- It does not create analytics/event records or run a database migration.
- It does not modify Supabase, GitHub, or Render automatically.

## Install
1. Extract this ZIP into your existing `creator-hub-live` repository (merge the `chl_live_analytics_better_method` folder; do not replace project folders).
2. From the repository root, run:
   `node chl_live_analytics_better_method/tools/apply-live-analytics-separation.mjs`
3. Run the regression test:
   `node chl_live_analytics_better_method/tests/live-analytics-separation.test.mjs`
4. Review the two changed source files, then commit/push and deploy using your normal workflow.

The updater validates both source files and all required anchors before writing either file. If source differs from the expected version, it stops without modifying either file. Tests use temporary fixtures; they do not claim the deployed website or APK was tested.
