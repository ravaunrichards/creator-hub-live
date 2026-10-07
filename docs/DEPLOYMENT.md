# Creator Hub Live — Deployment Guide

## Architecture Overview

```
Frontend (static SPA)  →  Backend (Node.js HTTP)  →  Supabase (PostgreSQL)
                       →  LiveKit Cloud (WebRTC media)
                       →  PayPal (REST API payments)
```

## Production Deployment Checklist

### 1. Database
- [ ] Apply all 8 migrations (`database/migrations/0001–0008`)
- [ ] Reload PostgREST schema cache: `NOTIFY pgrst, 'reload schema'`
- [ ] Verify RLS policies are active: check that anon-key queries are restricted
- [ ] Rotate the `service_role` key if it was ever exposed

### 2. Backend
- [ ] Deploy `backend/` to a Node.js runtime (VPS, container, or serverless)
- [ ] Set all environment variables (see `backend/.env.example`)
- [ ] **Rotate** any previously-exposed secrets (LiveKit API secret, Supabase service role key, PayPal client secret)
- [ ] Run `npm install --omit=dev` for production dependencies
- [ ] Run `npm run check` to verify routes and syntax
- [ ] Verify `/api/health` returns `{ ok: true }`
- [ ] Verify `/api/livekit/health` returns `{ configured: true }`
- [ ] Set up PayPal webhook pointing to your deployed `/api/payments/webhook`

### 3. Frontend
- [ ] Deploy `frontend/` to a static hosting service
- [ ] Set `config.js` with production values:
  - `SUPABASE_URL` — your Supabase project URL
  - `SUPABASE_ANON_KEY` — **publishable (anon) key only**
  - `API_BASE` — your deployed backend URL
- [ ] Ensure `service-worker.js` cache version matches release version
- [ ] Verify no secrets appear in frontend files (run `npm run check`)

### 4. CORS
The backend allows requests from origins listed in `FRONTEND_URL` (comma-separated).
For production, set this to your exact frontend origin (e.g. `https://creatorhub.live`).

### 5. Android (Optional)
- [ ] Sync `android/app/src/main/assets/web/` with `frontend/` (they should be identical)
- [ ] Replace `release.keystore` with your production signing key
- [ ] Build signed APK: `cd android && ./gradlew assembleRelease`
- [ ] The APK wraps the web bundle in a `WebViewAssetLoader` — no network needed for assets

### 6. Post-Deploy Verification
- [ ] Health endpoint responds
- [ ] LiveKit token endpoint returns tokens for authenticated users
- [ ] PayPal create-order returns an approval URL
- [ ] Webhook signature verification works (use PayPal sandbox to test)
- [ ] Wallet balance reads from server (not localStorage)
- [ ] League standings render from server API

## Rollback

Both original version archives are preserved in `backups/`:
- `backups/version-a.zip` — VERSION_A (v3.1.0 frontend + backend)
- `backups/version-b.zip` — VERSION_B (v3.2.0 frontend, no backend)

If you need to revert, extract the appropriate backup and redeploy.

## Environment-Specific Notes

### Sandbox / Development
- PayPal `PAYPAL_ENV=sandbox` — use sandbox client ID/secret
- `FRONTEND_URL=http://localhost:3000` — allows local testing
- LiveKit `developmentTokenServer` is for dev testing only — **never production**

### Production
- PayPal `PAYPAL_ENV=live` — use live credentials
- `FRONTEND_URL` must be your exact production origin
- LiveKit tokens MUST be minted server-side via `/api/livekit/token`
- All secrets must be rotated before first production deployment