# Manual Installation — Creator Hub Creator Network 3.4.0

This guide updates the **existing** `creator-hub-live` project. It does not create a new project and it does not deploy anything automatically.

## 1. Preserve a recovery point

Download/retain the currently deployed source and current database backup. Preserve Render build settings, environment values, Supabase policies and current migration history. Never share secret values in chat or put them into frontend files.

## 2. Update the existing source tree

Use the full source ZIP in a separate working folder first. Inspect `docs/RELEASE-3.4.0.md`, compare its tree with the existing `main` source, and copy the updated source into the existing repository through your normal manual workflow. Do not upload the ZIP itself as the website publish directory. Do not replace the production site until local tests pass.

## 3. Database preflight before migrations

Execute read-only SQL files:

- `database/diagnostics/feature_release_3_4_preflight.sql`
- `database/diagnostics/full_supabase_inventory_audit.sql`
- `database/diagnostics/league_schema_preflight.sql`

Review live migration history and backup. Migrations 0013–0020 already exist in the source tree, but their presence in a ZIP is not proof they have or have not been applied in the production database. Reconcile schema drift and sequencing first. Apply migrations 0021, 0022 and 0023 only after their prerequisites and security effects are approved. Migration 0023 adds persistent user settings, account/privacy policies, in-app schedule notifications, creator analytics and real-activity ranking RPCs. Do not treat a missing preflight item as permission to apply all historical migrations blindly.

## 4. Backend environment

In the existing Render backend service, verify the exact values using your own dashboard:

- `PAYPAL_ENV=live` or `PAYPAL_ENV=sandbox` (no leading `=`; do not mix sandbox and live credentials).
- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from the same PayPal environment.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the intended project (backend only).
- `FRONTEND_URL` set to the deployed frontend origin, unless a deliberate `PAYPAL_RETURN_URL` override is used.
- LiveKit server API key/secret/URL only if LIVEKit is enabled.
- `PAYPAL_WEBHOOK_ID` only after registering the deployed HTTPS `/api/payments/webhook` endpoint in the matching PayPal environment.

PayPal's return URL is an Orders API redirect sent by the backend. It is not a credential field in the PayPal Developer Apps & Credentials screen. Never paste a temporary OAuth access token into `PAYPAL_CLIENT_SECRET`.

## 5. Test and deploy manually

From the source root run:

```sh
npm run sync:android-web
npm run check
```

Resolve any failure before using the build. Deploy the website from the established Render static-site root `frontend/` and the server from `backend/` using your existing deployment configuration. Check `/api/health`; then use `docs/VALIDATION-3.4.0.md` for live acceptance.

## 6. Stop if production data disagrees

Do not manufacture missing profiles, team membership, leagues, matches, scores, payments or wallet balances. Do not delete or auto-credit historic pending PayPal records. If the preflight finds missing or unexpectedly shaped objects, stop and reconcile using backup, migration history and real application data.
