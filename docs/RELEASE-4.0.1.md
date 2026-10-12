# Creator Hub Creator Network — Website Release 4.0.1

## Why this patch release exists

Release 4.0.1 restarts the Teams/backend repair from the last complete saved website source package. It adds a read-only schema preflight and improves Teams API errors so missing `public.profiles` or another prerequisite is reported as a schema/configuration issue instead of a generic HTTP 500.

## Code changes

- `backend/src/teams-routes.js` now maps missing PostgREST relations/columns (`PGRST205`, `PGRST204`) and PostgreSQL missing-object errors (`42P01`, `42703`) to actionable HTTP 503 responses.
- Team profile-card lookups now identify `public.profiles` explicitly, so the error points to the actual failed relation.
- `database/diagnostics/teams_backend_restart_preflight.sql` reports required table and column presence without changing data.
- Teams deployment/version cache labels are aligned to 4.0.1; new regression checks cover the diagnostic pointers.
- `docs/TEAMS-BACKEND-RESTART.md` distinguishes the core Team backend from the separate `creator_leagues` feature and explains the safe migration dependency order.

## Important status

Manual-install source package only. No changes were made to GitHub, Supabase, Render, PayPal, or LiveKit. The active GitHub `main` branch was found to contain only `.gitignore` and `package.json`; recent commits removed the source directories. This package was built from the last complete saved website source release 4.0.0, not from that incomplete current tree. See `docs/RESTART-AUDIT-2026-10-12.md`.

## Website scope

This remains the existing core website/PWA, Node backend, migration history, diagnostics, test suite and operations documentation. It is website/backend source, not an Android APK. The course/Academy, games and mapping/translation/currency-tool modules remain outside this particular website release scope, as documented in the 4.0.0 release.

## Verification boundary

Local source and backend checks are recorded in `VALIDATION-4.0.1.md`. These checks do not prove that the live Supabase schema is complete, that Render is running this package, or that actual production users can use every flow. Apply SQL only after preflight, migration-history review and backup.
