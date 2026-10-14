# Creator Hub Creator Network — consolidated Teams/backend update

Target: existing repository `ravaunrichards/creator-hub-live`, branch `main`.

**Manual installation only.** Nothing in this ZIP has been applied to GitHub, Supabase, or a deployment.

## What the audit established

Read `AUDIT_FINDINGS.md` first. The key connection defects are confirmed in the current branch: the Teams route module is not imported/dispatched by the backend server, the CORS allow-methods header excludes `PATCH`/`DELETE`, and `frontend/index.html` does not load `src/pages-teams.js`. The supplied database output confirms `teams`, `team_members`, `leagues`, `league_seasons`, and `league_standings` exist; `creator_leagues` does not. The latter is a separate feature and is intentionally outside this Teams package.

## Files and integration changes

- `backend/src/teams-routes.js` — Teams API route module.
- `frontend/src/pages-teams.js` — complete Teams list, search, create/edit forms, details, roster and membership controls. It shows division placement rather than treating numeric levels 1–50 as league progression.
- `database/migrations/0015_teams_backend_complete.sql` — additive fields and server-only atomic RPC functions. The owner-membership backfill uses `ON CONFLICT DO NOTHING` so existing membership roles are not overwritten.
- `docs/server-integration.patch.txt` — three exact edits to the existing backend server.
- `docs/frontend-integration.patch.txt` — one script-tag insertion into the existing frontend entry point.
- `docs/PREFLIGHT.sql` — read-only prerequisite/column/division checks.
- `tests/teams-contract-check.mjs` — local static contract check.

## Installation order

1. Back up Supabase and preserve any local source edits. Do not replace the full server file with a sample.
2. Run `docs/PREFLIGHT.sql` in Supabase SQL Editor. Confirm `public.teams`, `public.team_members`, `public.leagues`, required columns, and division `D5` exist. Stop if prerequisites are missing; do not guess or blindly rerun other migrations.
3. Copy `backend/src/teams-routes.js` to the same path, then apply the exact import, dispatch, and CORS changes in `docs/server-integration.patch.txt` to the existing `backend/src/server.js`.
4. Copy `frontend/src/pages-teams.js` to the same path, then insert the script tag exactly as shown in `docs/frontend-integration.patch.txt`. Keep it after `src/pages-creator.js` so this route registration takes precedence, and before `window.CHL.start()`.
5. Review `database/migrations/0015_teams_backend_complete.sql`, then apply it once. It is additive and creates no fake teams or accounts. The owner membership backfill does not overwrite an existing role.
6. Run the local checks below, then deploy the backend and frontend using your own manual process.
7. Verify with real test accounts after deployment using the checklist below. Static checks do not prove live credentials or deployment behavior.

## API behavior

- `GET /api/teams?q=&limit=` — list/search and member counts.
- `GET /api/teams/:id` — team details and roster.
- `POST /api/teams` — authenticated team creation and owner membership.
- `PATCH /api/teams/:id` — owner-only editable profile/recruitment/member limit.
- `POST /api/teams/:id/join` and `/leave` — authenticated membership operations.
- `DELETE /api/teams/:id/members/:userId` — owner-only removal of a non-owner member.

The server validates the Supabase bearer token and derives the user ID; it does not trust a client-supplied owner ID. Team creation and joining use server-side RPC functions and capacity checks. The service-role key must remain in backend environment variables only.

## Division/level rule

The competition divisions are `A`, `A1`–`A3`, `B1`–`B5`, `C1`–`C5`, and `D1`–`D5`, with `D5` the lowest. New teams start in `D5`. The numeric `teams.level` column is retained for compatibility and is not used by this UI as league progression. Division movement, standings, promotion and relegation remain under the existing league system; users cannot set their own division or points through the Teams form.

## Local checks

From the package root:

```sh
node --check backend/src/teams-routes.js
node --check frontend/src/pages-teams.js
node tests/teams-contract-check.mjs
```

From the installed repository, also run its existing backend test/check scripts. Do not mark the live integration verified until you test: list teams; create a team and refresh to confirm persistence; join with a second account; reject duplicate join; edit as owner; reject edit as non-owner; leave as member; and remove a member as owner.
