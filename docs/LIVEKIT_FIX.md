# LiveKit LIVE Troubleshooting

## Backend configuration

Set these variables in the backend deployment environment only:

- `LIVEKIT_URL` — the LiveKit WebSocket URL from the LiveKit project dashboard
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Do not place the API secret in `frontend/config.js` or Android web assets. The browser receives a short-lived participant token from `POST /api/livekit/token`.

## Expected host flow

1. The authenticated host creates a pending LIVE session.
2. The frontend receives the backend-generated database `room_name`.
3. The host obtains a short-lived token restricted to camera and microphone publishing.
4. The client connects to LiveKit and publishes both tracks.
5. The frontend calls `POST /api/live/rooms/:id/start`.
6. The backend checks the host participant's published camera and microphone tracks before marking the database row `live`.

A pending room is reserved for its host; viewers cannot obtain tokens until the room is live. Ended rooms cannot be restarted or issued new tokens.

## Common failures

- `REQUIRES_CONFIGURATION`: set the backend environment variables and redeploy.
- `LIVEKIT_UNREACHABLE`: verify the URL, API key/secret pair, LiveKit project status, and network access.
- `LIVE_PUBLISH_REQUIRED`: ensure camera and microphone permissions were granted and both tracks are published before starting LIVE.
- `LIVE_ENDED` / `LIVE_NOT_STARTED`: reload the room list and join a valid session.

The automated checks are not a live WebRTC test. Verify with a real host and viewer device after deployment.
