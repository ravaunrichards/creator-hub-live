# Creator Hub Live

Creator Hub Live is a web-first social, LIVE, wallet, payments, teams and league application. This repository keeps the original project structure and edits the existing frontend/backend integrations in place.

## Architecture

Browser `web/` → `web/src/core.js` → canonical `api/server.mjs` → Supabase / LiveKit / PayPal / authoritative SQL functions.

`api/livekit/token.mjs` contains the server-only LiveKit token utility. It is not a second backend.

## Backend API

Health:
- `GET /api/health`
- `GET /api/livekit/health`
- `GET /api/config/public`

LiveKit:
- `POST /api/livekit/token`
- `POST /api/live/rooms`
- `GET /api/live/rooms/:id`
- `POST /api/live/rooms/:id/start`
- `POST /api/live/rooms/:id/end`
- `POST /api/live/rooms/:id/join`
- `POST /api/live/rooms/:id/leave`

Payments:
- `POST /api/payments/create-order`
- `POST /api/payments/capture-order`
- `GET /api/payments/:id`
- `POST /api/payments/webhook`
- `POST /api/payments/refund`

Wallet:
- `GET /api/wallet/balance`
- `GET /api/wallet/transactions`
- `POST /api/wallet/deposit`
- `POST /api/wallet/withdraw`
- `POST /api/wallet/purchase`
- `POST /api/wallet/gift`

Leagues:
- `GET /api/leagues`
- `GET /api/leagues/:leagueId`
- `GET /api/leagues/:leagueId/seasons`
- `GET /api/leagues/:leagueId/teams`
- `GET /api/leagues/:leagueId/matches`
- `GET /api/leagues/:leagueId/standings`
- `POST /api/leagues/:leagueId/matches/:matchId/result`
- `POST /api/leagues/:leagueId/matches/:matchId/correction`

Legacy PayPal/league endpoint paths remain as compatibility aliases where the original frontend used them.

## Configuration

Browser configuration is in `web/config.js`. Only browser-safe values belong there. The compatibility alias `window.CREATOR_HUB_API_BASE` and `CreatorHubConfig.api.baseUrl` are the canonical API base.

Leave the API base blank when the frontend and backend share one origin. For a split deployment, set the runtime override `window.__CREATOR_HUB_API_BASE__` or set the corresponding deployment value before the app loads. Do not invent a backend hostname.

Server variables are documented in `.env.example`. Private LiveKit, Supabase service-role, JWT and PayPal secrets must be rotated before production deployment.

## Database migrations

Run, in order:

`0001_identity_social.sql`
`0002_content_social.sql`
`0003_wallet_payments.sql`
`0004_live_social_systems.sql`
`0005_rls_policies.sql`
`0006_seed_config.sql`
`0007_payment_idempotency.sql`
`0008_server_authoritative_leagues.sql`

The existing migration filenames are preserved. Migration 0008 contains the league authority repairs, and 0003 contains wallet/payment authority repairs.

## Development

Requires Node 20+.

```bash
npm install
npm run dev
```

Static validation:

```bash
npm run check
npm run smoke
```

The route check validates browser route registration, canonical backend route presence and browser/public private-credential scanning. Full LiveKit, PayPal and Supabase integration tests require a configured/deployed environment and real rotated secrets, so source validation does not falsely mark those as online.

## Security rules

Never put service-role credentials, LiveKit API secrets, PayPal client secrets, webhook secrets or JWT signing keys in `web/`, PWA assets, documentation or source maps.

Wallet balances and ledgers are server/database authoritative. Client code cannot directly write wallet balances.

PayPal packages are selected server-side from `coin_packages`; the browser cannot choose the authoritative price. Capture and webhook credit use the provider capture ID as an idempotent key.

League points, standings, ranks, promotion and relegation are computed by the database functions. Clients may read standings but cannot directly write authoritative league state.

## Deployment status

The archive is **deployment-ready source**, not a claim that the external backend is already deployed. A production deployment still requires rotated private credentials, Supabase migration execution, LiveKit configuration, PayPal configuration/webhook registration, frontend/backend deployment and real integration testing.
