# Creator Hub Creator Network — Setup

## Backend environment

Set these variables in the deployed backend environment; never commit their values:

- `PORT`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `PAYPAL_ENV` (`sandbox` or `live`; `production` is accepted as an alias)
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_RETURN_URL`

`backend/.env.example` contains placeholders only. A short-lived PayPal access token from Postman is not a replacement for the PayPal client ID and secret; the backend obtains its own token.

## Database migrations

Check `database/diagnostics/league_schema_preflight.sql` before changing the database. Apply missing migrations only, in numeric order, after checking prerequisites. Migrations `0001`–`0012` establish the base system; `0013`–`0016` add wallet package contracts, creator-specific leagues, complete Teams support, and the official division catalog. Migration `0017` is an older Teams compatibility repair with narrower prerequisites; `0018` converges the current Teams API schema; `0019` adds league lifecycle and creator payout operations; `0020` repairs legacy wallet/gift schema contracts and explicitly grants sensitive wallet RPCs only to `service_role`. Do not rerun older migrations blindly; follow `docs/INSTALL.md` and `docs/DATABASE.md` for the safe order and prerequisites. After a migration changes table structure, run `NOTIFY pgrst, 'reload schema';` in the Supabase SQL Editor to refresh the PostgREST schema cache.

## Frontend configuration

`frontend/config.js` contains browser-safe configuration only. The backend is authoritative for payments and LiveKit token generation. The service worker uses a versioned cache; bump that version when changing cached assets and keep the frontend and bundled web assets synchronized with:

```bash
npm run sync:android-web
```

## Verification

```bash
npm run check
npm run teams:check
npm run league:check
npm run repair:contracts
npm run backend:check
npm run backend:test
npm run backend:smoke
```

Source tests cannot verify the user's live database, PayPal credentials, deployed backend, or real-device rendering. Test those in the actual services after deployment.
