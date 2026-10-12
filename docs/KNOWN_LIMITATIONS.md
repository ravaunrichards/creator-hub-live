# Creator Hub Creator Network — Verification Status

## Verified locally in this package

- Frontend route registration and source structure checks.
- Backend JavaScript syntax checks.
- Teams route/UI contract checks.
- Team league standings API tests for an active season, a no-active-season empty state, and missing-table/schema-cache errors.
- Static payment/cache contract checks.
- Frontend-to-bundled-web asset parity after synchronization.

## Not verified here

- The live Supabase schema and whether migrations 0008, 0014, 0015, and 0016 are already applied.
- Production backend environment variables, CORS origin, and reachability from the deployed frontend.
- PayPal sandbox/live OAuth, checkout, capture, webhook verification, and wallet reconciliation with the account's actual credentials.
- Real account flows, real match data, and responsive rendering in a live browser on the user's devices.
- LiveKit camera/microphone publishing and playback between separate users.

## Deployment boundary

A static website deployment does not deploy the Node backend or apply Supabase migrations. These are three separate operations. Confirm the frontend publish directory is `frontend/`, deploy the backend from `backend/`, and inspect the schema preflight before applying only the migrations that are actually missing. Do not claim a feature is resolved until it is tested in the target environment.
