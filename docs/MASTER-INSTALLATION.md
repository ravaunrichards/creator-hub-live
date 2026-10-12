# One-Page Installation Checklist

1. Back up repository and database.
2. Extract ZIP; merge the full `creator-hub-live-main` project contents into the existing repository working folder. Preserve local secrets/configuration.
3. Run `database/diagnostics/league_schema_preflight.sql`. Check migration history before applying anything. If team-season tables are missing, inspect prerequisites and apply `0008_server_authoritative_leagues.sql`; `0014` is for creator-created leagues, `0015` for Teams, and `0016` for division labels. Never rerun migrations blindly.
4. Install Node dependencies in root and backend if missing.
5. Run `npm run sync:android-web`, then `npm run check`. The root check includes structure, security, Teams, league, backend syntax, and route tests.
6. Review test results. Do not deploy if a required check fails.
7. Manually commit/deploy when ready, then test Teams and Leagues using real accounts.
8. Rollback: restore the repository backup. Before database changes, restore the database backup if needed; migration `0016` can be reversed by restoring the previous `tier` and `rank` values from your backup.

Nothing in this package has been installed or deployed automatically.
