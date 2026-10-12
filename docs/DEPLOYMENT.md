# Deployment guide — Creator Hub Creator Network 4.0.1

## Architecture

Static website/PWA (`frontend/`) → Node.js backend (`backend/`) → Supabase. LIVE video/signaling uses LiveKit. Coin checkout uses PayPal Orders/Capture and server-side idempotent ledger updates. Creator payout requests are stored for review; this request flow does not itself transfer fiat money.

## Manual deployment only

No production service was changed when preparing this package. Publish `frontend/` as the static-site root and deploy `backend/` as a separate Node.js 20+ service. A static-site publish does not deploy backend code or apply database migrations.

## Order of operations

1. Back up deployed source/configuration and Supabase.
2. Run the read-only schema audits and reconcile migrations/policies/functions before applying a database change.
3. Configure backend environment variables using `backend/.env.example` for names only.
4. Apply an approved missing database migration (especially 0024) only after reviewing its preflight requirements and effects.
5. Deploy backend and verify `GET /api/health`, `GET /api/config/public`, and `GET /api/livekit/health`.
6. Publish `frontend/` as the site root. Verify the actual URL/API base, CORS, storage bucket and browser-safe config.
7. Complete `VALIDATION-4.0.1.md` and `PRODUCTION-ACCEPTANCE-CHECKLIST.md` before release acceptance.

## PayPal

Keep `PAYPAL_ENV`, client ID and client secret matched to the same PayPal app/environment. Restart/redeploy the actual backend after environment changes. The backend should fetch OAuth tokens itself. A Postman token is temporary and is not a replacement for backend credentials. Test create-order, PayPal approval, capture, webhook verification and single ledger credit in the target environment.

## Rollback

Keep the prior frontend and backend source plus environment-variable snapshot. If routes fail, restore the previous known-good release at the service layer. SQL changes are forward migrations and must not be reversed by guessed `DROP` statements; use a reviewed forward fix or restore plan if data/schema changes have committed. Service rollback does not roll back database mutations.
