# One-Page Installation Checklist

1. Back up repository and database.
2. Extract ZIP; merge the full `creator-hub-live-main` project contents into the existing repository working folder. Preserve local secrets/configuration.
3. Check migration history. Only apply `0016_official_division_tiers.sql` after confirming `0006` and `0008` are installed.
4. Install Node dependencies in root and backend if missing.
5. Run: `npm run check`, `npm run teams:check`, `npm run backend:check`, `npm run backend:test`, `npm run repair:contracts`, `npm run sync:android-web`.
6. Review test results. Do not deploy if a required check fails.
7. Manually commit/deploy when ready, then test Teams and Leagues using real accounts.
8. Rollback: restore the repository backup. Before database changes, restore the database backup if needed; migration `0016` can be reversed by restoring the previous `tier` and `rank` values from your backup.

Nothing in this package has been installed or deployed automatically.
