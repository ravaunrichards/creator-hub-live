# Creator Hub Live — LiveKit production repair

## Authoritative configuration

Project: `creator-hub-live`

Project ID: `p_3iyxbyzr2vp`

WebSocket: `wss://creator-hub-live-iwqooqmr.livekit.cloud`

SIP URI: `sip:3iyxbyzr2vp.sip.livekit.cloud`

## Token architecture

Browser
→ Supabase authentication
→ Creator Hub canonical backend
→ `POST /api/livekit/token`
→ server verifies the Supabase bearer token
→ server derives identity from the verified user ID
→ server creates a short-lived LiveKit JWT
→ browser connects to LiveKit

The LiveKit API secret never enters browser JavaScript.

## Required server environment

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET` (rotated before deployment)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOKEN_TTL_SECONDS`
- `FRONTEND_URL`

## Room lifecycle

`POST /api/live/rooms` creates a database room in `pending` state.

The host requests the token and connects to LiveKit.

Only after the real LiveKit connection succeeds does the browser call:

`POST /api/live/rooms/:id/start`

The room then changes to `live`.

A database row by itself is therefore not presented as an active video connection.

## Permissions

The backend derives the LiveKit identity from the verified Supabase user ID.

The host receives publish, subscribe and data permissions. Other authenticated participants receive subscribe/data permissions unless the backend later authorizes a more specific guest role.

The backend validates the stored room name and room ownership before issuing a token.

## CORS and headers

Set `FRONTEND_URL` to the actual frontend origin(s), separated by commas for multiple trusted origins. The backend rejects disallowed browser origins and sends security headers on API responses.

## Health checks

`GET /api/livekit/health` confirms that the LiveKit server configuration exists without returning the secret.

`GET /api/health` confirms the Creator Hub backend process is reachable.

## Testing

Static/source validation:

```bash
npm run check
```

Real production validation must additionally confirm Supabase login, token issuance, LiveKit connection, camera/microphone permissions, remote participant subscription, reconnect and disconnect behavior.

## Troubleshooting

`AUTH_REQUIRED` — the Supabase session is missing or expired.

`BACKEND_UNAVAILABLE` — the API base or backend deployment is unreachable.

`INVALID_ROOM` — the room ID is missing, closed or invalid.

`TOKEN_GENERATION_FAILED` — server LiveKit configuration is missing or invalid.

`MEDIA_PERMISSION_DENIED` — browser camera/microphone permission was refused.

`LIVEKIT_CONNECTION_FAILED` — the browser could not establish the actual LiveKit session.

## Security

Rotate any previously exposed private LiveKit credentials before production deployment. Never place private credentials in `web/config.js`, HTML, CSS, PWA assets, APK assets or documentation.
