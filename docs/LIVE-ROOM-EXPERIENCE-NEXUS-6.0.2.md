# Nexus 6.0.2 — LIVE room experience integration

This update continues the existing Creator Hub Creator Network application. It adds backend routes and controls to the existing LIVE room rather than creating a second room implementation.

## Connected features

| Feature | Endpoint family | Enforcement |
|---|---|---|
| Live participant list | `GET /api/live/rooms/:id/participants` | Authenticated room access; stage membership is derived from saved guest rows and LiveKit when available |
| Gift activity | `GET /api/live/rooms/:id/gift-events` | Read-only view of persisted `gift_transactions`; asset keys fall back to the local price-free manifest |
| Audience reactions | `GET/POST /api/live/rooms/:id/reactions` | Allow-listed reactions, rate-limited per room/account, server timestamped |
| Polls and votes | `/api/live/rooms/:id/polls` and `/:pollId/vote`, `/:pollId/close` | Host creates/closes polls; votes upsert one record per user and poll; no fake results |
| Audience questions | `/api/live/rooms/:id/questions` | Audience can submit; host/moderators can pin, answer and remove |
| Moderator management | `/api/live/rooms/:id/moderators` | Host-only grant/removal; target profile must exist |
| Room settings | `GET/PATCH /api/live/rooms/:id/settings` | Host-only; audience, title, category, guest permissions and HTTPS cover URL are validated |
| Room analytics | `GET /api/live/rooms/:id/analytics` | Host/moderator only; calculations come from persisted chat, guest and gift rows |
| Recording management | `/api/live/rooms/:id/recordings` | Host-only; recording is unavailable until LiveKit Egress and private object storage are configured |
| Schedule management | `/api/live-experience/schedules` | Authenticated creator owns their schedules; no schedule auto-starts a stream |

All these routes use the existing backend authentication and service-role database client. The module does not replace core LIVE lifecycle endpoints, nor does it debit/credit wallets directly. Gift settlement must continue through the current server-authoritative `send_gift` RPC.

## Database migration order

Nexus already uses `0025_live_guest_request_workflow.sql`. Historical repository snapshots reused the numbers 0025–0029 for other migrations, including a gift-price migration whose old prices must not be replayed into the current database. This release therefore adds **`0026_nexus_live_room_experience.sql`** after the current Nexus 0025. It adds feature tables and room access controls without seeding rooms, polls, votes, reactions, recordings or gifts and without changing coin prices or diamond values.

Before production, export a database backup and run the supplied schema inventory/preflight diagnostics against the target project. Verify the actual Supabase migration ledger and compare column/policy state. Do not blindly rerun historical migrations or apply this file twice outside the migration tool's normal tracking.

## Private recording setup

The optional feature requires the existing server-side LiveKit variables and a private S3-compatible bucket. Configure the following only in the backend hosting environment, never in browser config:

- `LIVE_RECORDING_S3_BUCKET`
- `LIVE_RECORDING_S3_REGION` (or `AWS_REGION`)
- `LIVE_RECORDING_S3_ACCESS_KEY` (or `AWS_ACCESS_KEY_ID`)
- `LIVE_RECORDING_S3_SECRET_KEY` (or `AWS_SECRET_ACCESS_KEY`)
- `LIVE_RECORDING_S3_ENDPOINT` for compatible storage when needed
- `LIVE_RECORDING_S3_FORCE_PATH_STYLE=true` when required by the provider
- `LIVE_RECORDING_CLEANUP_SECRET` if calling the optional recording-retention cleanup endpoint

Recordings are written to a private storage path. Download endpoints return a short-lived signed URL only after the server marks a recording ready. Delete requests remove the stored object before marking the row deleted. The cleanup endpoint requires an exact secret in the `x-live-recording-cleanup-secret` header and deletes only rows whose retention expiry has passed. Use a private bucket with lifecycle and access controls appropriate for personal video; do not enable public bucket access.

## Validation boundaries

The automated checks cover source syntax, route wiring, selected authorization/input cases, migration lexical balance, file presence, gift asset files and Android web-asset parity. They do not prove that a particular Supabase schema accepts the migration, that credentials work, that LiveKit Egress uploads to the configured bucket, or that downloads work on a real device. Test those in a staging project and with a test recording before relying on this feature in production.
