# CHL Original Rank Ladder and Standing Route Inspection

**Inspection date:** 2026-10-18 UTC  
**Repository:** `ravaunrichards/creator-hub-live`, `main` (read-only source inspection)  
**Backend service:** `creator-hub-live-backend` (`srv-db2seq49v7es73a3tla0`)  
**Supabase project:** `txibryhznycmuqufnxvh`

## Confirmed source defects

1. `backend/src/teams-routes.js` already contains `GET /api/leagues/my-standing` and `GET /api/leagues/standings`; its current GitHub blob SHA is `51810941cfaaefce7d4fb283c83cfd03559eed99`, so it is not an install target.
2. `backend/src/server.js` dispatches only `/api/teams` and `/api/teams/*` to `handleTeamsRoute`. It does not dispatch `/api/leagues/*`, so the existing standing handlers can be bypassed and the request can fall through to a 404 / `NOT_FOUND` response.
3. The website rank page `frontend/src/chl-rank-achievements.js` has eight tiers (Bronze, Silver, Gold, Platinum, Diamond, Heroic, Master, Grandmaster). The Android WebView rank page already has the requested five-tier order. This means web and Android are inconsistent.
4. The five-tier list in the earlier package had removed Silver and Gold sublevels. This package revision preserves the existing sublevels: Bronze I–III, Silver I–III, Gold I–IV, followed by Master and Grandmaster. It does not add Platinum, Diamond, or Heroic.
5. The season names remain Opening Season, Rising Stars, Champions League, and All-Star Season. Team league divisions A1–D5 remain separate from competitive rank.

## Read-only database check

A read-only count query returned:

| Table/state | Rows |
|---|---:|
| `public.teams` | 0 |
| `public.team_members` | 0 |
| `public.league_seasons` | 0 |
| `public.league_standings` | 0 |
| Active seasons | 0 |

This is important: even after route dispatch is corrected, the current database has no recorded teams, memberships, season, or standings to display. The fix must report the real empty state; it must not fabricate a membership, rank, division, points, or season.

## Render inspection

- Backend service is configured for `main` and reports a live deployment.
- The latest deployment's referenced commit `c2167dbcd6260964859a70e824da7220c592bd1a` changes only the Android rank-page file; it does not fix `backend/src/server.js` dispatch.
- The queried Render request logs returned no matching `/api/leagues/my-standing` or `/api/leagues/standings` rows for the selected window. Therefore logs do not independently prove the user's exact request path or response.
- No deployment was triggered as part of this inspection.

## Correction package contents

- `frontend/src/chl-rank-achievements.js`: aligns the website rank ladder with the requested five-tier ladder and preserves Bronze/Silver/Gold sublevels.
- `android/app/src/main/assets/web/src/chl-rank-achievements.js`: matching WebView file; byte-identical to the website rank page in this package.
- `reference/teams-routes.js`: read-only copy of the existing handler for test/review only; it is not an install target.
- `apply-server-route-fix.mjs`: guarded one-line patch to the existing `backend/src/server.js` dispatch condition. It makes a backup and stops if the expected source line is not found exactly once. It does not replace `server.js`.
- Tests cover standing handler behavior, authenticated-member filtering, error mapping, rank ladder structure, web/Android parity, and route-patch contract.

## Validation results

- `node --check` passed for the included backend route and both rank-page copies.
- Standing-service tests passed, including no active season, valid own-team standing, excluding a non-member team's standing, and membership database error mapping.
- Route-registration contract test passed.
- Website and Android rank-page files are byte-identical.
- The guarded installer was separately smoke-tested against a disposable fixture: it changed only the expected dispatch line, created the backup, and stopped safely for an unexpected source layout.

These are local source/package tests, not a deployed authenticated API test or a physical-device test.

## Not changed

No GitHub source, Supabase records/schema/policies, Render service configuration, live deployment, or APK was modified by this inspection. Install and deploy only when ready, then verify the route with a signed-in account and configure real teams/seasons through the authorized league workflow.
