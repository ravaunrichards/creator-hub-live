# Restart audit — 12 October 2026

## Repository state observed

Read-only inspection of `ravaunrichards/creator-hub-live`, branch `main`, found that the current HEAD is `92dcc8981c265ecbabddcdfc2301cb570d91ab28` (`Delete tests directory`). The recursive Git tree at that HEAD contains only `.gitignore` and root `package.json`. Recent commits removed `android/`, `backend/`, `database/`, `docs/`, `frontend/`, `releases/`, `scripts/` and `tests/`. The root `package.json` still references several removed test/script/backend paths, so the current HEAD is not a runnable complete website source tree.

No repository changes were made as part of this audit.

## Source used for this restart package

Used the saved complete website source archive `Creator-Hub-Creator-Network-Complete-Website-Release-4.0.0.zip` (111 archive entries) as the baseline, not the incomplete current HEAD. The source was extracted into a separate temporary working directory; changes in this release ZIP are not pushed to GitHub, Supabase or Render.

## Confirmed Teams connection from source

- Teams page script is loaded by `frontend/index.html`.
- Backend server imports and dispatches both `handleTeamsRoute` and `handleTeamLeagueRoute`.
- The backend CORS allow-methods list includes `PATCH` and `DELETE`.
- `pages-teams.js` has create/edit/detail/roster/join/leave/removal flows; competitive division is derived from the official division code, not a user-entered numeric level.
- `team-leagues.js` returns a schema-specific error when `league_seasons` is absent or not visible through PostgREST.
- Existing read-only `league_schema_preflight.sql` checks for `profiles`, team tables, division catalog, season/standings/matches, and separately lists `creator_leagues`.

## Issue fixed in this restart package

The Team detail member-profile query previously called the shared database-error normalizer without naming `profiles`; missing relation/column errors from this path could degrade to a generic HTTP 500. Release 4.0.1 explicitly names `profiles` and converts missing-schema errors to HTTP 503 with links to a focused read-only diagnostic and the relevant base migration order. This is an error-reporting fix, not a live database schema repair.

## Validation boundary

The local validation commands run against the package are recorded in `docs/VALIDATION-4.0.1.md` and `LOCAL-TEST-RESULTS-4.0.1.txt`. No production SQL migration or real external service call was executed; production schema/cache correctness and visual rendering on physical devices remain open acceptance checks.
