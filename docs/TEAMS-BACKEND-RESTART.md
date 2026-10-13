# Teams backend restart and connection guide

## Fresh starting point

This is a manual restart using the last complete saved website source package. It does not change the live repository or database. First read `docs/RESTART-AUDIT-2026-10-12.md` because the currently checked GitHub `main` tree is incomplete.

## What is already connected in this source package

- `frontend/index.html` loads `src/pages-teams.js`.
- `backend/src/server.js` imports and dispatches `handleTeamsRoute` and `handleTeamLeagueRoute`.
- Backend CORS includes the `PATCH` and `DELETE` methods used by team edits/member removal.
- Team creation, join, and owner updates call server-only database RPCs. The browser does not choose owner IDs, competitive division, or points.
- The official competitive division ladder consists of `A1`–`A3`, `B1`–`B5`, `C1`–`C5`, `D1`–`D5`; `D5` is the entry/lowest division. The legacy numeric `teams.level` field is not used as league progression.

Therefore the current reported `league_seasons` schema-cache error should be investigated as a database/migration/cache or backend-target problem, not addressed by adding another numeric level selector to the team form.

## Step 1 — Back up and diagnose only

1. Back up the exact Supabase project/database and save the current backend environment names (do not copy secret values into the frontend or this ZIP).
2. Run `database/diagnostics/teams_backend_restart_preflight.sql`.
3. Run `database/diagnostics/league_schema_preflight.sql`.
4. Record which tables/columns are `false`/missing. Check the backend's `SUPABASE_URL` and service-role environment point to the same project you inspected.

The preflight is read-only. It does not invent teams, seasons, standings, profiles or creator leagues.

## Step 2 — Choose migrations by the failed dependency

Do not execute every migration blindly against an existing database. Review actual installed history and compare current columns first.

- `public.profiles` missing: stop and inspect `0001_identity_social.sql` plus the existing identity/auth setup. Do not jump to a Teams compatibility migration.
- `public.teams` or `public.team_members` missing: review `0004_live_social_systems.sql` and the existing schema before applying anything.
- `public.leagues` or division `D5` missing: review the catalogue seed `0006_seed_config.sql` and official labels/order migration `0016_official_division_tiers.sql` after prerequisites exist.
- `public.league_seasons` or `public.league_standings` missing in PostgreSQL: review `0008_server_authoritative_leagues.sql` and verify its `profiles`/`teams`/`leagues` prerequisites. Migrations `0017` and `0018` explicitly require these relations and are not substitutes for a missing `0008` base.
- Missing Teams API fields or server RPCs: review `0015_teams_backend_complete.sql`, then only the compatibility/convergence repairs that match preflight findings (`0017`/`0018`).
- Missing fixture operation fields such as `league_matches.round_number`: review `0019_league_operations_and_payouts.sql` and its dependencies.
- `public.creator_leagues` and its registration/fixture/payment tables belong to the separate creator-league feature in `0014_creator_league_server.sql`. Their absence does not by itself break `/api/teams` or the football/team-league standings route. Apply 0014 only when specifically enabling that separate feature.

If the expected table exists in PostgreSQL but PostgREST reports `PGRST205`, first verify the backend is using the same Supabase project. After confirming the table/schema change, run this in SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

## Step 3 — Test backend and website locally

From package root run `npm run check` and `npm run repair:contracts`. For a focused Teams check run `node tests/teams-contract-check.mjs`. Check syntax for the backend and frontend Teams files. The tests are local/static or mocked; they do not make live database calls.

## Step 4 — Deploy manually and test with real accounts

Deploy backend before publishing the corresponding frontend source. Confirm `/api/health` reports the expected backend release and `GET /api/teams` returns a truthful empty state or real persisted teams. Test a real signed-in owner creating a team, refresh/persistence, a second user joining, duplicate membership rejection, owner edit, member leave/removal, and standings. Season creation/activation and match result entry must be tested with an administrator account only. Never seed fake teams, users, scores, seasons, standings or payment entries to make the page look populated.

## Stop conditions

Stop and investigate if base tables are missing, the backend points at a different Supabase project, a migration aborts on a prerequisite, existing identities/role rows would need to be guessed, or any local check fails. Do not mark the live integration complete until the live acceptance steps actually pass.
