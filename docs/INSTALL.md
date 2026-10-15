# Manual installation — Creator Hub Creator Network 4.0.0

This is a manual-install source bundle for the existing project. It makes no changes to GitHub, the live database or hosting by itself.

## 1. Before starting

1. Confirm you are installing into the existing `ravaunrichards/creator-hub-live` project.
2. Make a backup of the currently deployed website and backend source/configuration.
3. Take a Supabase database backup and save current migration history, environment settings and hosting build settings.
4. Save current health-check output, PayPal test evidence, LIVE test evidence and team/league state.
5. Review `KNOWN_LIMITATIONS.md`, `SECURITY.md`, `DATABASE.md`, `DEPLOYMENT.md` and `VALIDATION-4.0.0.md`.

## 2. Package layout

- `frontend/` is the static-site root. Deploy its contents as the website. Do not upload the project root as if it were a static directory.
- `backend/` is the Node.js API application. Deploy it through the existing backend service, with Node 20+ and server environment variables.
- `database/migrations/` is an ordered history. Migration files are not an instruction to run every migration over a database which already has them.
- `database/diagnostics/` contains read-only inspection SQL.
- `tests/` and `backend/tests/` contain code/contract tests.

## 3. Configuration and secrets

`frontend/config.js` contains the existing deployment's browser-safe settings and may include a public Supabase publishable/anon key. Treat that as public browser configuration, not a secret. Review the API URL, Supabase URL, and configured media storage bucket before deployment.

`frontend/config.example.js` is a template only; its example values are not production credentials. Never place Supabase service-role keys, PayPal client secrets, OAuth access tokens, webhook IDs/secrets, LiveKit API secrets, or JWT signing keys in frontend files or a public repository.

Configure the backend with `backend/.env.example` as the variable-name reference only. Do not overwrite working PayPal settings blindly. The backend should acquire short-lived PayPal OAuth tokens from its configured client credentials; a manually copied temporary access token is not a durable configuration.

## 4. Database work

Run these read-only diagnostics first:

- `database/diagnostics/full_supabase_inventory_audit.sql`
- `database/diagnostics/creator_community_preflight.sql`
- `database/diagnostics/league_schema_preflight.sql` for team league tables

Compare the results with the current installed migration history. If a migration has already been applied, do not replay it. Resolve missing prerequisites and policy-name conflicts before applying a later migration. Migration 0024 adds account state, RLS hardening, mission/claim tables, battles, verification and gift rankings. Review it against the real database and back up before applying.

Do not seed example users, standings, gifts, payment records, missions or verification badges to make pages look populated. Empty states are correct when no real records exist.

## 5. Backend installation

Install and test the existing backend in its deployed service/workspace:

```sh
cd backend
npm install
npm test
npm start
```

Use the existing provider configuration and health route. Verify `GET /api/health` and `GET /api/config/public`; do not expose server environment variables in responses or logs. Deploy the backend before relying on the new account lifecycle endpoints.

## 6. Website installation

1. Publish `frontend/` through the current static website service.
2. Confirm `frontend/config.js` points to the correct existing API and Supabase project.
3. Confirm the service serves `index.html` and all local `src/`, `styles/`, and `assets/` paths.
4. Confirm the service-worker cache uses release 4.0.0 and invalidate any CDN cache only if needed.
5. Run `npm run check` from the release root before deployment and `npm run repair:contracts` after installation in a copy of the source workspace.

## 7. Rollback

If a new route or backend release fails, redeploy the previously saved website/backend source and configuration. Database changes are forward-only unless a migration explicitly supplies a reviewed rollback. Do not manually drop tables or reverse policies by guessing. If migration 0024 has been applied and fails acceptance, disable affected UI routes through a reviewed forward change and preserve records while investigating.

## 8. Final sign-off

Use `VALIDATION-4.0.0.md` and `PRODUCTION-ACCEPTANCE-CHECKLIST.md`. Only mark complete when production checks have been performed against the actual deployment. Local tests do not constitute live acceptance.
