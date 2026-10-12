# Error recovery — Release 3.2.6

This coordinated update is for the existing `ravaunrichards/creator-hub-live` project. It makes no remote changes automatically.

## PayPal environment error

Use the backend service environment configuration, not a frontend-only setting:

- Live: `PAYPAL_ENV=live`, with the Client ID and Client Secret from the same live PayPal app.
- Sandbox: `PAYPAL_ENV=sandbox`, with the matching Sandbox Client ID and Client Secret.

The backend accepts common aliases (`production`, `prod`, `test`, `testing`, and PayPal Live/Sandbox labels); environment variable names are read case-insensitively. Remove conflicting duplicate keys and redeploy/restart the backend. Never use a Postman OAuth access token as the Client Secret.

After deployment, open the backend base URL plus `/api/health` and confirm the JSON contains `"backendRelease":"3.2.6"`. Then open `/api/config/public` and check `paypalEnvironment`. If the release marker is old or absent, the deployed service is stale or the frontend points to another backend. If the environment is `invalid`, check the precise backend environment value; the error reports that non-secret value.

## Teams error `TEAMS_LOOKUP_FAILED` / SQLSTATE `42703`

SQLSTATE `42703` means PostgreSQL is referencing a missing column. The updated Teams endpoint reports the database's original message so the missing name can be compared to `database/diagnostics/league_schema_preflight.sql`. Review the existing migrations before running another one. Migration `0017_team_schema_compatibility_repair.sql` adds expected supplemental Teams/member fields, normalizes legacy/unknown competitive division codes to D5, and repairs standings enrollment for active seasons/new teams. It must only be applied after its named base tables and D5 catalog entry are confirmed. After schema changes, reload the PostgREST schema cache with `NOTIFY pgrst, 'reload schema'` if needed.

If the same error remains after the migration and backend deployment, use the newly reported exact column/message. That indicates either an uncovered schema difference or that the live backend/database differs from the package assumptions; do not repeatedly run migrations blindly.

## “No active season” / standings empty

The division catalog and promotion/relegation rules are not themselves a season. `/api/leagues/standings` looks for a `league_seasons` row whose `status` is `active`. The new admin-only screen at Admin → Leagues lets a verified administrator enter the official season name and exact start/end date-times. Immediate activation is allowed only inside that time window, and only one active season is permitted. If a season is scheduled to start later, activate it during its date window. No dates or season name are invented.

Season setup initializes rows for existing teams. The SQL trigger enrolls teams created afterward in the active season. New competitive teams are assigned to D5; division changes and promotion/relegation remain server-managed.

## Install order and test boundary

1. Back up the repository/database and preserve private config separately.
2. Run the read-only schema preflight against the intended Supabase project.
3. Review existing migration prerequisites, then apply migration 0017 manually only after confirming its preconditions.
4. Merge this package into the existing repository; deploy the backend and website separately.
5. Check the backend release marker, PayPal public config, Teams page, wallet payment chooser, and season/standings flow while signed in.

Local automated checks cover syntax, route contracts, mocked season setup/activation, PayPal environment parsing, and frontend asset synchronization. They do not access live Supabase, production hosting, PayPal credentials, or real user devices. End-to-end production behavior is therefore unverified until checked by the project owner after installation.
