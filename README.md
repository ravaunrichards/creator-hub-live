# Creator Hub Next — clean frontend

This is a separate, origin-fresh frontend package. It does **not** import the old frontend's HTML, CSS, route modules, or app shell. The existing backend is left untouched.

## Preview locally

Run any static file server from this folder, for example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Existing backend connection

By default, `app.js` requests the existing backend at:

`https://creator-hub-live-02c1.onrender.com`

To point it at another compatible API, define `window.CREATOR_HUB_API` before `app.js` loads. The current integration attempts `GET /api/live/rooms` and `GET /api/livekit/health`; other actions remain explicitly unconnected until the actual backend contract and authentication flow are verified. This package does not invent account data, coin balances, gifts, comments, or viewer counts.

## GitHub and Render

This folder is intentionally independent so it can be reviewed before any replacement. For a safe rollout, add it to the existing repository under a new directory such as `frontend-next/`, verify it locally, then change the existing Render **frontend service's** root directory to `frontend-next/` only when ready to switch. Do not change the backend service's root directory or overwrite the current frontend during review. Render static-site publish directory should be `.` for this plain static bundle. Keep the existing repository and backend service.

## Important status

This is a new frontend foundation and interaction prototype, **not a claim that all social functions are production-integrated**. Like/follow are local preview interactions only. Authentication, publishing, comments, messaging, wallet/gifts, persistent follows/likes, and LiveKit room join/start require a verified API contract and signed-in user flow before they can be called functional. A visible empty state is used rather than fabricated records.
