# Creator Hub Creator Network — Recovery Package

Existing project: `ravaunrichards/creator-hub-live`, branch `main`. This ZIP contains the full source tree, not patch files. No GitHub, database, or live deployment was changed while preparing it.

## Manual installation

1. **Back up** your current repository and keep existing local `.env` files private. Do not delete the working project or upload secrets.
2. Extract the ZIP. Copy the contents of `creator-hub-live-main/` into your existing repository working folder, reviewing same-name files before replacing them.
3. Deploy the **frontend** using `frontend/` as the static publish directory. This includes the service-worker cache fix and payment UI fix.
4. Deploy the **backend separately** from `backend/` (`npm install`, then `npm start`). Set its existing production environment variables on the backend host. The browser configuration cannot fix backend code that was not deployed.
5. In Supabase, run `database/diagnostics/league_schema_preflight.sql` first. Apply only migrations that are missing, in numeric order, after confirming their prerequisites. In particular, migration `0008` creates team-season tables such as `league_seasons`; `0014` creates `creator_leagues`; `0015` completes Teams support; `0016` updates the official division labels. Do not blindly rerun migrations or create sample records.
6. After a migration that creates/fixes tables, run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL Editor, then wait briefly for the schema cache to refresh.
7. From the repository root, run `npm run check`, `npm run teams:check`, `npm run league:check`, `npm run repair:contracts`, `npm run backend:check`, and `npm run backend:test`. Review failures before deploying. Then check the deployed backend's `/api/health` and test the actual feature while signed in.

## Important

- A successful deployment only confirms that the hosting platform deployed something; it does not prove the frontend, backend, database, or PayPal flow is connected and working.
- `backend/.env.example` now contains placeholders only. Supply your real credentials through the backend host's environment settings; never copy placeholders into production.
- PayPal OAuth `401` means the backend's client ID/secret and selected environment need to match. The server obtains its own access token; do not store a short-lived Postman access token as a permanent environment variable.
- Static source checks do not verify your live Supabase schema, PayPal account, deployed API, or actual phone/tablet rendering.
