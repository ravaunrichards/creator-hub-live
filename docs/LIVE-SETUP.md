# Creator Hub Creator Network — LIVE setup and verification

This guide applies to the existing website and Node.js backend. It is not a claim that the current deployment has been tested against LiveKit.

## Configuration

Set these variables only in the backend hosting environment:

- `LIVEKIT_URL` — your LiveKit WebSocket URL
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`
- `PORT` (when required by the host)

Use `backend/.env.example` for the complete variable list. Keep the service-role key and LiveKit API secret out of browser code, website config, documentation and source control. Rotate credentials if a private value has previously been disclosed.

## Session lifecycle

The website authenticates through Supabase and requests its LIVE token from `POST /api/livekit/token`. The backend derives the LiveKit identity from the verified user and validates room ownership/permissions. LIVE room creation, actual LiveKit connection, start confirmation, participant join, chat and end states are separate steps; a database row alone is not proof that media is working.

## Health and checks

- `GET /api/health` — backend reachability and safe configuration status
- `GET /api/livekit/health` — LiveKit configuration status without returning its secret
- `GET /api/config/public` — browser-safe public configuration

Run `npm run check` from the release root before manual deployment. It is a local source/contract suite and does not connect real cameras, microphones, Supabase Auth, or LiveKit.

## Manual acceptance

Use two test accounts and two real devices/browsers. Verify start/join, camera and microphone permission, remote participant media, host/guest authorization, chat persistence, disconnect/reconnect, end state and empty/error states. Keep PayPal and other existing backend environment variables intact when deploying this backend.

## Troubleshooting

- `AUTH_REQUIRED` / authentication failures: confirm the Supabase session and backend URL.
- token generation or room authorization failure: inspect backend logs without printing access tokens or secrets.
- camera/microphone failure: check browser permissions and device selection.
- room state mismatch: compare the real session row and backend logs; do not manually mark a stream live to simulate success.
