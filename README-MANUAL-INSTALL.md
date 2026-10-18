# CHL — Original Rank Ladder and Standing Route Correction

## Findings this package addresses

- The current `backend/src/teams-routes.js` already has `GET /api/leagues/my-standing` and `GET /api/leagues/standings`. Do **not** replace it; its GitHub blob SHA is `51810941cfaaefce7d4fb283c83cfd03559eed99`.
- `backend/src/server.js` only dispatches `/api/teams` and `/api/teams/*` to that route handler. The guarded installer adds `/api/leagues/*` to the existing dispatch condition and creates a backup first. It does not replace the server file.
- The website's current rank page has eight ranks, while the Android copy has five. This package aligns both copies to the requested five ranks while preserving sublevels: **Bronze I–III, Silver I–III, Gold I–IV, Master, Grandmaster**.
- The season names remain Opening Season, Rising Stars, Champions League, and All-Star Season. A1–D5 are team league divisions, separate from competitive ranks.
- The standing page now distinguishes missing team membership, missing active season, no official position yet, and a service/API error. It never invents standing data.

## Manual installation

1. Back up these two existing rank-page files:
   - `frontend/src/chl-rank-achievements.js`
   - `android/app/src/main/assets/web/src/chl-rank-achievements.js`
2. Extract this ZIP into the root of your existing `creator-hub-live` repository, preserving folder paths. Replace **only those two rank-page files**. The `reference/teams-routes.js` file is for read-only review/tests; do not copy it over the existing backend file.
3. From the repository root, run:

   ```sh
   node chl-league-standing-fix/apply-server-route-fix.mjs
   ```

   This applies one guarded line change to your existing `backend/src/server.js` and creates `backend/src/server.js.before-chl-league-route-fix.bak`. If the script stops with an error, do not force it; inspect the current source first.
4. Run the checks below. The two test files are inside `chl-league-standing-fix/tests/` and use the read-only handler reference bundled with this ZIP.
5. Review the diff before committing or deploying. This package has not changed GitHub, Render, Supabase, or the live site.

## Validation

From the repository root after installing the two rank-page files:

```sh
node --check frontend/src/chl-rank-achievements.js
node --check android/app/src/main/assets/web/src/chl-rank-achievements.js
cmp frontend/src/chl-rank-achievements.js android/app/src/main/assets/web/src/chl-rank-achievements.js
node chl-league-standing-fix/tests/league-standing-service.test.mjs
node chl-league-standing-fix/tests/server-route-registration.test.mjs
```

The guarded installer was separately smoke-tested against a disposable fixture. It changed only the expected dispatch line, made a backup, was idempotent when rerun, and stopped safely for an unexpected source layout.

## Read-only database findings (2026-10-18)

- `public.team_members`, `public.league_seasons`, `public.league_standings`, and `public.teams` exist.
- Counts at inspection time were zero for `teams`, `team_members`, `league_seasons`, and `league_standings`; there was no active season.
- Therefore the route correction can remove the dispatch `NOT_FOUND` failure, but a real team standing will still require real team/member records and an active season configured through the authorized league workflow. No teams, memberships, ranks, points, or seasons were fabricated.

## Limits

Syntax and focused local source tests passed. No authenticated real-user request, live deployment, database write, or physical-device test was performed. The source fix must be manually installed and deployed before its effect can be verified on the live website.
