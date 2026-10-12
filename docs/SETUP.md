# Creator Hub Creator Network — Setup

## Backend environment

Set these variables in the real deployment environment; never commit their values:

- `PORT`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `PAYPAL_ENV`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_RETURN_URL`

A template is provided at `backend/.env.example`.

## Database

Apply migrations `0001` through `0012` in order against the intended Supabase database. Do not skip or reorder migrations.

## Frontend configuration

`frontend/config.js` contains browser-safe configuration only. The current checked-in frontend configuration is copied into the Android packaged web tree by:

```bash
npm run sync:android-web
```

The backend is authoritative for the LiveKit WebSocket URL returned by the token endpoint; no LiveKit API secret belongs in browser assets.

## Verification

```bash
npm run check
npm run backend:check
npm run backend:test
npm run backend:smoke
npm run repair:contracts
```

Android requires the Gradle wrapper/SDK before `assembleDebug` or `assembleRelease` can be executed.
