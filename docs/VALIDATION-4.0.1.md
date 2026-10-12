# Release 4.0.1 validation record

## Local validation commands

Run from the extracted package root:

```sh
npm run check
npm run repair:contracts
node --check backend/src/teams-routes.js
node --check frontend/src/pages-teams.js
node tests/teams-contract-check.mjs
```

This release checks the site-shell asset map, script/version cache consistency, internal route links, JavaScript syntax, frontend secret patterns, migration static structure, Teams route wiring, and mocked/in-process backend contracts.

## Manual production acceptance still required

- Back up the target Supabase database and deployed source/config first.
- Run `database/diagnostics/teams_backend_restart_preflight.sql` and `database/diagnostics/league_schema_preflight.sql` against the exact database used by the backend.
- Compare missing table/column results with installed migrations. Do not apply migrations just because they appear in this ZIP.
- Confirm the backend environment points to the intended Supabase project and keeps the service-role key server-side.
- Verify `/api/health`, `GET /api/teams`, sign-in, team creation, refresh persistence, roster/profile lookup, join/duplicate join, owner-only edit, leave, member removal, `/api/leagues/standings`, and administrator-only season controls with real test accounts.
- If `public.league_seasons` exists in PostgreSQL but PostgREST returns `PGRST205`, confirm the backend target project, then run `NOTIFY pgrst, 'reload schema';` in SQL Editor.
- Verify browser layout on actual mobile/tablet/desktop viewports and complete the production acceptance checklist.

A passing local test run is not evidence that any production migration has been applied or that hosting/payment/LIVE credentials work.
