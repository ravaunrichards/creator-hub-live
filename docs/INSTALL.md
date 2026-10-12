# Creator Hub Creator Network — Recovery Package

Existing project: `ravaunrichards/creator-hub-live`, branch `main`. This ZIP contains the full source tree, not patch files. No GitHub, database, or live deployment was changed while preparing it.

## Manual installation

1. **Back up** your current repository and keep existing local `.env` files private. Do not delete the working project or upload secrets.
2. Extract the ZIP. Copy the contents of `creator-hub-live-main/` into your existing repository working folder, reviewing same-name files before replacing them.
3. Deploy the **frontend** with `frontend/` as the static publish directory. The host must publish this folder, not the repository root. The website and backend are separate deployments.
4. Deploy the **backend separately** with `backend/` as the service root (`npm install`, then `npm start`). Confirm the backend deployment uses the updated `backend/src/server.js` and `backend/src/team-leagues.js`. A successful frontend deployment does not update the backend.
5. In Supabase SQL Editor, run `database/diagnostics/league_schema_preflight.sql` first. If `public.league_seasons` or related team-season tables are absent, inspect the migration history and prerequisites, then apply the existing `database/migrations/0008_server_authoritative_leagues.sql`. Migration `0014` is separate and creates `creator_leagues`; `0015` completes Teams support; `0016` updates official division labels. Do not blindly rerun migrations or create sample records.
6. After a migration that creates/fixes tables, run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL Editor, then wait briefly for the schema cache to refresh.
7. From the repository root, run `npm run check` and `npm run repair:contracts`. Fix any failures before deployment. Then check `/api/health` and, while signed in, `/api/leagues/standings`. The league endpoint returns an honest empty state when no season is active and an actionable error if required tables are missing.

## Important

- A successful deployment only confirms that the hosting platform deployed something; it does not prove the frontend, backend, database, or PayPal flow is connected and working.
- `backend/.env.example` now contains placeholders only. Supply your real credentials through the backend host's environment settings; never copy placeholders into production.
- PayPal OAuth `401` means the backend's client ID/secret and selected environment need to match. The server obtains its own access token; do not store a short-lived Postman access token as a permanent environment variable.
- Static source checks do not verify your live Supabase schema, PayPal account, deployed API, or actual phone/tablet rendering.
