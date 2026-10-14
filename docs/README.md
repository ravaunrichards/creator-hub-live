# Creator Hub Creator Network

This is the existing Creator Hub Live source project, maintained in place rather than rebuilt from an empty project.

## Main folders

- `frontend/` — canonical browser/PWA frontend
- `backend/` — Node.js API, LiveKit token/verification code, backend contract tests
- `database/migrations/` — ordered Supabase SQL migrations
- `android/` — Android Studio/Gradle WebView app; packaged web assets live under `android/app/src/main/assets/web/`
- `tests/` — repository integration, repair-contract, and security-audit checks
- `docs/` — setup, deployment, security, release, test, and file replacement instructions

## Backend APIs

- Health/config: `GET /api/health`, `GET /api/livekit/health`, `GET /api/config/public`
- LIVE: token, room create/join/start/end, room list, and persistent chat routes
- Wallet/payments: wallet balance/transactions, active coin catalog, gift sending, PayPal order/capture, payout information, webhook
- Leagues: `GET /api/leagues/standings` reads active-season standings from the database

See `docs/API.md` for the route list. Only real database-backed rows are returned; no fake users, reviews, viewers, or standings are seeded.

## Configuration and secrets

`frontend/config.js` contains browser-safe configuration. `backend/.env.example` contains placeholders only. Use real values in your deployment environment, not source files. Rotate any private credentials that appeared in the previously supplied archive. The original keystore and APKs were intentionally excluded from the corrected source package.

## Database

For a new database, apply migrations `0001` through `0013` in numeric order. See `docs/SETUP.md` before applying changes to an existing production database.

## Development and validation

Requires Node.js 20 or later:

```bash
npm run check
npm run backend:check
npm run backend:test
npm run backend:smoke
npm run repair:contracts
```

The checks are static/contract tests. They do not certify live Supabase, LiveKit, PayPal, Android device, or Play Store behavior.

## Important remaining limitations

Multi-guest invitations/host-moderator guest controls and switchable LIVE layouts 1–4 are not implemented by this repair pass. See `docs/KNOWN_LIMITATIONS.md` and `docs/TEST_REPORT.md` for the unverified items.
