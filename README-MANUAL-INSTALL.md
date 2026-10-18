# CHL — League Standing / Team Membership Service Correction

## What this corrects
- Adds authenticated `GET /api/leagues/my-standing` using the existing backend service-role database client.
- Resolves the signed-in user's `team_members` rows and filters official standings on the server, rather than running a browser-side `team_members` REST query in parallel with a separate standings request.
- Keeps the existing `GET /api/leagues/standings` response contract.
- Distinguishes “no active league season” from a service failure. It does not create seasons, teams, memberships, results, or points.
- Shows a safe backend error code in the UI instead of collapsing every failure into an indistinguishable generic message.
- Includes the same rank/achievement page in the web and Android WebView asset paths.

## Manual installation
1. Back up these existing source files first:
   - `backend/src/teams-routes.js`
   - `frontend/src/chl-rank-achievements.js`
   - `android/app/src/main/assets/web/src/chl-rank-achievements.js`
2. Extract this ZIP into the root of the existing `creator-hub-live` repository, preserving folder paths. Replace only the three matching files listed above. Do not replace `backend/src/server.js` with a package copy.
3. From the repository root, run `node chl-league-standing-fix/apply-server-route-fix.mjs`. This makes the one-line route-dispatch fix in your existing server file and creates `backend/src/server.js.before-chl-league-route-fix.bak`. If the script stops with an error, do not force it; inspect the current source first.
4. Run the validation commands below in the project root. Also run `node tests/server-route-registration.test.mjs`.
5. Commit/deploy only when you are ready. This package has not changed GitHub, Render, Supabase, or the live site.

## Validation
From project root:

```sh
node --check backend/src/teams-routes.js
node --check frontend/src/chl-rank-achievements.js
node chl-league-standing-fix/tests/league-standing-service.test.mjs
node chl-league-standing-fix/tests/server-route-registration.test.mjs
cmp frontend/src/chl-rank-achievements.js android/app/src/main/assets/web/src/chl-rank-achievements.js
```

The added test is included in this ZIP. Copy `tests/league-standing-service.test.mjs` to your repository's `tests/` folder before running it, or run it from this extracted package after the source files are in place.

## Confirmed database findings (read-only audit, 2026-10-18)
- `public.team_members` exists; `public.league_team_members` does not. The application must use the canonical `team_members` table.
- `public.league_seasons`, `public.league_standings`, `public.teams`, and `public.leagues` exist and have the columns used by the existing route.
- RLS is enabled on the relevant tables; SELECT grants and policies were visible for `team_members`, `league_seasons`, `league_standings`, `teams`, and `leagues`.
- Current counts are zero for `teams`, `team_members`, `league_seasons`, and `league_standings`; there is no active season. The correction intentionally reports that state rather than generating false standings.
- The Supabase migration history contains migration `0050_team_league_route_schema_and_active_season_guard`, but a same-named source file was not found at the expected `database/migrations/` path in GitHub main. Reconcile migration-source history before applying any schema migration.
- Supabase performance advisors reported 55 unindexed foreign-key findings across the database. These are separate optimization findings and are not changed by this focused correction. Security advisors also reported callable `SECURITY DEFINER` functions; each requires function-by-function authorization review rather than blanket changes.

## Limitations
The new route, frontend, and guarded server route-registration correction are source-level fixes. No live API request with an authenticated user was possible from this audit, no Supabase write was performed, and no Render deployment or physical-device test was performed. A real team standing will remain unavailable until real team/member records and an active season are correctly configured by the project's authorized setup process.
