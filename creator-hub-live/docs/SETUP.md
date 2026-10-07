# Creator Hub Live — Setup Guide

## Prerequisites

- **Node.js** ≥ 20.0.0
- **Supabase** project (hosted or self-hosted) with the 8 migrations applied
- **LiveKit Cloud** project (or self-hosted LiveKit server)
- **PayPal Developer** account (sandbox for testing, live for production)

## 1. Database Setup

Run the migrations in order against your Supabase PostgreSQL database:

```bash
# Option A: Supabase CLI
supabase db push --db-url "$SUPABASE_DB_URL"

# Option B: Apply each migration manually in the Supabase SQL Editor
# Files: database/migrations/0001_identity_social.sql through 0008_server_authoritative_leagues.sql
```

Migrations are idempotent where possible (uses `IF NOT EXISTS`, `IF NOT NULL`). They must be applied **in numeric order** (0001 → 0008).

After applying, reload the PostgREST schema cache:
```sql
NOTIFY pgrst, 'reload schema';
```

## 2. Backend Configuration

```bash
cd backend/
cp .env.example .env
```

Edit `backend/.env` and replace all `REPLACE_WITH_*` placeholders:

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | Your LiveKit server WebSocket URL (e.g. `wss://your-project.livekit.cloud`) |
| `LIVEKIT_API_KEY` | LiveKit API key (from LiveKit Cloud dashboard) |
| `LIVEKIT_API_SECRET` | LiveKit API secret — **rotate before first production deploy** |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — **server-side only, rotate before deploy** |
| `FRONTEND_URL` | Your deployed frontend origin (used for CORS and PayPal return URLs) |
| `API_BASE` | Your deployed backend origin |
| `PAYPAL_CLIENT_ID` | PayPal REST API client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal REST API secret — **server-side only** |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID for signature verification |

⚠️ **NEVER** commit a populated `.env` to version control.

## 3. Backend Install & Start

```bash
cd backend/
npm install
npm run dev    # development (auto-restart on file change)
npm start      # production
```

The backend listens on port 3000 by default (`PORT` in `.env`).

## 4. Frontend Configuration

```bash
cd frontend/
cp config.example.js config.js
```

Edit `frontend/config.js` and set:
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — your publishable (anon) key
- `API_BASE` — your deployed backend URL (e.g. `https://api.creatorhub.live`)

## 5. Serve the Frontend

The frontend is a static SPA — serve `frontend/` with any static file server:

```bash
# Quick test
npx serve frontend/

# Or deploy to Vercel/Netlify/Cloudflare Pages
```

## 6. Android Build (Optional)

The Android wrapper uses `WebViewAssetLoader` to serve the web bundle from `android/app/src/main/assets/web/`. Those files are synced with the canonical `frontend/` directory (v3.2.0).

```bash
cd android/
./gradlew assembleRelease
```

⚠️ The sandbox environment cannot build or sign APKs. The provided `release.keystore` is a placeholder — replace it with your own signing key.

## 7. Verification

```bash
# Backend syntax + route check
cd backend/ && npm run check

# Full test suite
cd backend/ && npm run test
```

## Health Check Endpoints

Once running, verify:
- `GET /api/health` — returns `{ ok: true }`
- `GET /api/livekit/health` — returns LiveKit configuration status
- `GET /api/public-config` — returns frontend-safe public configuration