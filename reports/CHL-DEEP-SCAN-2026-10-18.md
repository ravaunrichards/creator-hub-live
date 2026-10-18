# CHL Deep Scan — League Standing / Team Membership Failure

**Date:** 2026-10-18  
**Repository reviewed:** `ravaunrichards/creator-hub-live`, `main` (read-only GitHub inspection)  
**Supabase project inspected:** `Creator-Hub-Live` (`txibryhznycmuqufnxvh`)  
**Render backend inspected:** `creator-hub-live-backend` (`srv-db2seq49v7es73a3tla0`)

## Confirmed cause path

The current `frontend/src/chl-rank-achievements.js` makes two independent requests in a single `Promise.all()`:

1. Browser-side Supabase REST query to `team_members` for the current user.
2. Backend request to `/api/leagues/standings`.

Any rejection from either request is caught by one generic handler and displayed as “Standing could not be verified — The league or team-membership service is unavailable.” The page hides which service actually failed. The source inspection confirms this diagnostic weakness. The actual failed browser request was not available in Render logs, so the exact historical trigger cannot be proven from logs alone.

## Live database read-only findings

- `public.team_members` exists; `public.league_team_members` does **not** exist. Use the canonical `team_members` table.
- `public.league_seasons`, `public.league_standings`, `public.teams`, and `public.leagues` exist. The inspected columns match the select fields used by the existing standings route.
- RLS is enabled for all five relevant tables. SELECT grants were present for `anon` and `authenticated`; the inspected policies included read policies for standings/seasons/teams/leagues and a read policy for team memberships.
- Current row counts: `teams = 0`, `team_members = 0`, `league_seasons = 0`, `league_standings = 0`; active seasons = 0.
- An empty active-season result is handled by the existing backend as HTTP success with `{ season: null, standings: [] }`. It should not by itself trigger the generic unavailable error. It does mean no real standing can currently be displayed.
- No team, member, season, result, or score was inserted to make the screen appear populated.

## Source correction prepared

- Added authenticated backend route `GET /api/leagues/my-standing`.
- The backend now resolves the signed-in user's membership and official active-season standings using the existing server-side database client in one request. It only returns standings for team IDs belonging to that authenticated user.
- The existing public `/api/leagues/standings` contract is preserved.
- The rank page now distinguishes: no team membership, no active season, no official standing yet, and a real service error. A safe backend error code is shown for diagnosis.
- Web and Android WebView copies are identical.

## Other audit findings

- Supabase migration history includes `0050_team_league_route_schema_and_active_season_guard`, but a same-named source file was not found at the expected `database/migrations/` path on GitHub `main`. Migration-source drift needs reconciliation before applying schema changes.
- Supabase performance advisors reported **55 unindexed foreign-key findings** across public tables. These are performance advisories, not proof that this standing failure is caused by indexes; no unrelated indexes were added in this focused fix.
- Supabase security advisors reported callable `SECURITY DEFINER` functions. These require per-function privilege and authorization review; a blanket revoke could break legitimate application workflows, so no database changes were made.
- Render logs for 2026-10-18 included PayPal `INVALID_REQUEST` / HTTP 400 responses that the backend normalized to `PAYMENT_PROVIDER_ERROR` / HTTP 502. These are unrelated to league standings and remain a separate payment-provider issue.
- Older Render logs recorded missing `teams.description` and a missing `paypal_payout_info` schema-cache object on 2026-10-12. The current database now has `teams.description`; `paypal_payout_info` was not re-tested in this focused league audit.

## Validation performed

- `node --check` on the prepared backend route and frontend rank page: passed.
- Focused route contract test: passed. Covers no active season, valid own-team standing, excluding non-member teams, and database membership error mapping.
- Web and Android rank page byte comparison: passed.
- Existing recovered-workspace checks: `npm run check` reported **396 passed, 0 failed**; `npm run backend:check`, `npm run backend:test`, and `npm run backend:smoke` passed. These checks ran in the recovered local workspace, not in a pristine checkout of current GitHub `main`, so they are not represented as a full deployed-source build verification.

## Still unverified / not changed

- No authenticated real-user request was run against the deployed API during this audit; recent Render request logs returned no matching `/api/leagues/standings` or team-member route requests in the queried window.
- No GitHub write, Supabase write, Render deployment, or APK build was performed.
- The source correction is packaged for manual installation only. After deployment, verify `/api/leagues/my-standing` while signed in, then create/activate a real season through the authorized league admin workflow. The endpoint must return real memberships and actual standings only.


## Critical route-wiring defect confirmed on GitHub main
- `backend/src/server.js` imports `handleTeamsRoute`, but its dispatch guard only matched `/api/teams` and `/api/teams/*`. Both `/api/leagues/standings` and the new `/api/leagues/my-standing` therefore bypassed this handler and fell through to later routing/404 handling.
- The package now includes `apply-server-route-fix.mjs`, a guarded in-place patch that adds `/api/leagues/*` to the dispatch condition, refuses unexpected source layouts, and makes a one-time backup before editing. This deliberately avoids replacing the full developed `server.js`.
- This defect was verified against the live `main` source at scan time. The patch is local/manual only because the GitHub integration rejected branch creation with HTTP 403. No production deployment has been performed.
