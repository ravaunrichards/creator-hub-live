# Creator Hub Creator Network — Teams backend completion package

Target repository: `ravaunrichards/creator-hub-live`, branch `main`.

This is a manual-install update package. It does not edit GitHub, Supabase, or deployment automatically.

## What's included

- `database/migrations/0015_teams_backend_complete.sql` — additive schema fields and transaction-safe server-side RPCs for team creation and joining. Existing teams, points, levels and divisions are retained.
- `backend/src/teams-routes.js` — API handler for list/search, detail/roster, create, edit, join, leave and owner member-removal actions.
- `frontend/src/pages-teams.js` — complete responsive Teams list, create form, team details, owner editing, membership actions and roster.
- `docs/server-integration.patch.txt` and `docs/frontend-integration.patch.txt` — exact small edits needed to connect the new files to the existing app.
- `docs/PREFLIGHT.sql` — checks the actual prerequisite tables and league division catalog before migration.
- `tests/teams-contract-check.mjs` — local static contract checks for this update package.

## Before installation

1. Make a Supabase backup.
2. Confirm the existing repository is on the intended branch and preserve any local edits.
3. Open `docs/PREFLIGHT.sql` in the Supabase SQL Editor and run it read-only.
4. The Teams migration depends on the existing league schema: `public.teams`, `public.team_members`, `public.leagues`, and `public.teams.division_code` must exist, and `public.leagues` must contain `D5`.
5. If prerequisites are missing, use the existing repository migrations in dependency order: `0004_live_social_systems.sql`, `0006_seed_config.sql`, `0008_server_authoritative_leagues.sql`, then `0010_rls_hardening.sql` — only apply a migration if its changes are not already installed. Do not blindly rerun a non-idempotent migration. If any migration fails, stop and resolve that error before continuing.

## Installation order

1. Copy `backend/src/teams-routes.js` into the repository at the same path.
2. Apply the three targeted backend edits in `docs/server-integration.patch.txt`:
   - import `handleTeamsRoute`;
   - dispatch to it before the existing infrastructure/health routes;
   - allow `PATCH` and `DELETE` in the CORS methods header.
   Keep all other existing `server.js` code.
3. Copy `frontend/src/pages-teams.js` into `frontend/src/pages-teams.js` and make the one script-tag insertion in `docs/frontend-integration.patch.txt`.
4. Review `database/migrations/0015_teams_backend_complete.sql`, then apply it once in Supabase.
5. Deploy the backend and frontend using your normal manual process.
6. Run the checks below before treating the update as complete.

## API contract

- `GET /api/teams?q=&limit=` — public list/search with member counts.
- `GET /api/teams/:id` — team details and roster; authenticated requests also receive membership/owner flags.
- `POST /api/teams` — authenticated team creation; owner membership is created atomically.
- `PATCH /api/teams/:id` — owner-only edit of name, description, parish, logo/badge URLs, recruitment state and member limit.
- `POST /api/teams/:id/join` — authenticated join with locked capacity check.
- `POST /api/teams/:id/leave` — authenticated member leave; owners cannot leave until ownership transfer exists.
- `DELETE /api/teams/:id/members/:userId` — owner-only removal of a non-owner member.

The server derives identity from the validated Supabase bearer token. Creation, joining and edits lock the team row where needed to preserve member-capacity and owner checks under concurrent requests. The client cannot set owner ID, team points, numeric level or division. Service-role credentials must remain server-side.

## Level / league rule

The existing `teams.level` column and values remain untouched for compatibility. The Teams UI stops presenting levels 1–50 as league progression and instead displays `division_code` (A, A1–A3, B1–B5, C1–C5, D1–D5). New teams enter D5. Division placement, standings, promotion and relegation remain controlled by the existing server-managed league system. This update does not invent a second competing level system.

## Checks

From this package folder:

```sh
node --check backend/src/teams-routes.js
node --check frontend/src/pages-teams.js
node tests/teams-contract-check.mjs
```

Then from the installed repository's `backend` folder, run the existing checks:

```sh
npm test
```

The local package checks are static checks only. They do not prove that the live backend, Supabase credentials, migrations, CORS, or deployed website are working. Confirm using a test creator account after deployment: list teams, create one, refresh and confirm persistence, join with a second account, verify member count/roster, reject duplicate join, edit as owner, reject edit as non-owner, leave as member, and remove a member as owner.
