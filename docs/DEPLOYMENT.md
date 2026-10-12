# Creator Hub Creator Network — Deployment (Release 3.3.0)

## Architecture

Static website/PWA (`frontend/`) → Node backend (`backend/`) → Supabase  
LIVE media/signaling → LiveKit  
Coin purchase provider → PayPal Orders/Capture and server-side ledger  
Creator payout request → `diamond_withdrawals` ledger → externally processed PayPal transfer recorded by an authorized admin

## Deployment is manual and split

No remote deployment occurred while preparing this package. Publish `frontend/` as the static-site root and deploy `backend/` as a separate Node 20+ service. A website publish does not deploy the backend or apply database migrations. Set the API base URL to the backend actually deployed, and set `FRONTEND_URL` to the actual frontend origin(s) allowed by CORS.

## Database first

Run `database/diagnostics/league_schema_preflight.sql` against the correct Supabase project. Review the real migration history. Do not rerun the entire migration chain blindly. Use the prerequisite and sequencing instructions in `docs/RELEASE-3.3.0.md` for 0017/0018/0019/0020. After an approved SQL change commits, execute `NOTIFY pgrst, 'reload schema';`.

## Required private backend configuration

Use `backend/.env.example` as a variable-name reference; its placeholder values are not production values. Keep Supabase service-role credentials, PayPal client secrets, webhook secrets, LiveKit API secrets and signing material on the server or in the appropriate private build environment only.

For PayPal Live, use `PAYPAL_ENV=live` with the Live Client ID and Client Secret belonging to the same PayPal app. For Sandbox, use `PAYPAL_ENV=sandbox` with matching Sandbox credentials. Remove conflicting aliases (`PAYPAL_MODE`, `PAYPAL_ENVIRONMENT`) and restart/redeploy the actual backend after settings change. Do not use a short-lived Postman OAuth access token as a Client Secret.

## Release identity checks

After the backend deployment, check:

- `GET /api/health` — expected `backendRelease: "3.3.0"`.
- `GET /api/config/public` — expected `paypalEnvironment` `live` or `sandbox`.
- `GET /api/livekit/health` — expected result for the configured LiveKit service.

A release marker only says which code responded. It does not prove live Supabase schema, permissions, OAuth, checkout, webhook processing, or payment reconciliation.

## Feature flows to verify

1. Sign in with a test account and load Teams; create/edit/join a test team if allowed.
2. Sign in as an authorized admin and create a season with the real intended dates. The backend refuses out-of-window activation or a second active season.
3. Generate missing fixtures, enter a test result, correct it, and confirm standings are recalculated; test finalization restrictions before closing a season.
4. Buy Coins through PayPal sandbox/live as appropriate; verify approved order, capture, webhook and idempotent wallet credit.
5. Save creator PayPal destination, submit a payout request, and test an admin rejection/refund. To mark paid, first perform the actual external PayPal transfer and record its returned transaction reference.
6. Test LiveKit host camera/microphone publication and viewing from separate user sessions.
7. Test responsive page navigation, long text/forms/tables, login/logout, and user journeys on real small and large screens.

## Payout semantics

Creator payout requests debit diamonds atomically and store a destination snapshot. The current release does not automatically submit PayPal Payouts API transfers and does not define a fixed diamonds-to-fiat conversion rate. An admin must choose/record the actual fiat amount, execute a real transfer externally, and record its transaction ID. Rejecting a request refunds diamonds with a unique ledger entry.

## Validation boundary

Local test results are in `docs/FINAL-VALIDATION-REPORT.md`. The test suite does not have the owner's live database credentials, private PayPal keys, hosting connection or device fleet; real integration testing remains a manual post-deployment requirement.
