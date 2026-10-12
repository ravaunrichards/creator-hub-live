# Creator Hub Creator Network — Teams audit findings

Audit target: repository `ravaunrichards/creator-hub-live`, branch `main`, read-only inspection on 2026-10-12, plus the user's Supabase SQL Editor output.

## Confirmed from the supplied Supabase output

- `public.teams`, `public.team_members`, `public.leagues`, `public.league_seasons`, and `public.league_standings` exist.
- `public.creator_leagues` is missing. This belongs to a separate creator-league feature/migration (`0014_creator_league_server.sql`) and is not silently created by this Teams update.
- No application migration-history table was found by the supplied checks. The `auth`, `realtime`, and `storage` migration tables are Supabase subsystem tables, not proof that this app's migrations were applied.
- RLS is enabled on all public tables shown in the user's result.
- The supplied policy list does not include policies for `teams` or `team_members`. The Teams feature in this package reads/writes through the backend service-role client; do not expose the service-role key or add browser write policies as a workaround.

## Confirmed from read-only inspection of branch `main`

- `backend/src/teams-routes.js` exists, but `backend/src/server.js` does not import or dispatch to `handleTeamsRoute`.
- Backend CORS currently allows `GET, POST, PUT, OPTIONS`, not `PATCH` and `DELETE`, which the Teams API needs.
- `frontend/src/pages-teams.js` exists, but `frontend/index.html` does not load it. The page therefore cannot replace/register the complete Teams screen.
- Existing league configuration defines divisions `A`, `A1`–`A3`, `B1`–`B5`, `C1`–`C5`, and `D1`–`D5`, with `D5` the lowest. `teams.level` is a legacy numeric field; the Teams screen should use `division_code`, not levels 1–50, as competition progression.

## Scope and safety

This package connects the existing Teams route and UI, installs the additive Teams schema/RPC migration, and adds static contract checks. It does not modify GitHub, Supabase, or deployment automatically. It does not seed fake users/teams, alter existing points/divisions, or create `creator_leagues`. Review that separate missing migration only when continuing that separate feature.
