# Recovery checklist — website release 4.0.1

Use this after a manual update if a core feature fails. Do not diagnose based on an old release archive or a success message alone.

## Website load / black screen

1. Open browser developer tools or remote debugging and capture the first console exception/network failure.
2. Verify the deployed `frontend/index.html` loads every local `src/`, `styles/`, `assets/` resource successfully.
3. Verify all cache-busted local scripts use release 4.0.1 and the service-worker cache uses `chcn-web-v4-0-1`.
4. Clear/update the service worker only after confirming the intended build has been published. A failed module should show an explicit error, not a blank panel.

## Backend unavailable

1. Request `/api/health` and `/api/config/public`; confirm the response is from the intended existing service and release 4.0.1.
2. Check server logs for missing env vars, Supabase auth or schema errors, CORS and network timeouts.
3. Do not put service-role keys or provider secrets in browser config. Do not publish raw tokens in logs or screenshots.

## PayPal checkout failure

1. Confirm `PAYPAL_ENV` and client ID/secret correspond to the same PayPal app/environment.
2. Confirm the backend was restarted/redeployed after environment changes.
3. Diagnose provider HTTP status and redacted request logs without posting credentials.
4. Test a sandbox or approved low-risk order and verify the database payment, capture ID, idempotency and single ledger credit. A temporary OAuth token from Postman is not a backend credential.

## Migration/schema error

Run `database/diagnostics/full_supabase_inventory_audit.sql`, `creator_community_preflight.sql` and, for teams, `league_schema_preflight.sql`. Do not rerun migration files blindly; compare real installed history and stop on missing prerequisites or schema drift. Capture the exact error code and relevant table/function/policy names while redacting secrets and personal data.

## Rollback

Restore the last saved website/backend source/config. Treat database migrations as forward-only unless an explicit, reviewed recovery exists; do not drop tables, delete records or reverse policies by guesswork. See `INSTALL.md` and `KNOWN_LIMITATIONS.md`.
