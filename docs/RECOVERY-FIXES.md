# Recovery and regression notes

- The website has an explicit loader error handler and local asset checks; use the browser console to identify the first module/asset error rather than repeatedly closing/reopening the app.
- PayPal checkout uses the backend's configured credentials. Do not paste short-lived OAuth bearer tokens into environment variables that are intended to hold client IDs/secrets.
- A schema cache error such as missing `public.league_seasons` means the connected Supabase schema/migrations need inspection; a frontend patch does not create the missing database table.
- Team creation/editing, season standings and payout processing are server/database-backed; tests use source contracts and mock/in-process flows, not live money or production user data.
- After any release, run `npm run check`, `npm run repair:contracts`, then manual acceptance steps. Keep the previous source and database backup until release acceptance passes.
