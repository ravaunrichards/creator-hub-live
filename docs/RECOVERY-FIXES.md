# Recovery corrections included

- **Frontend cache:** bumped the service-worker cache version and changed the main stylesheet to network-first so a new deployment does not keep showing the previous cached layout. Added the Teams page to the precache shell.
- **PayPal order approval:** backend now returns the approval URL that the wallet expects. The old response omitted `approveUrl`, so checkout could not redirect even after order creation.
- **PayPal return/capture:** return and cancel URLs now match the app's hash-router flow. The wallet recognizes the backend's `captured` / `completed` response instead of incorrectly displaying a pending message after a completed capture.
- **Payment-method choice:** selecting a coin package opens a payment-method step. PayPal is the only offered method until another provider is actually integrated.
- **PayPal environment/auth:** accepts `sandbox`/`test` and `live`/`production`; invalid values fail clearly instead of silently routing to Sandbox. OAuth 401 now explains that the client ID/secret pair must match the selected environment.
- **League database diagnosis:** added a read-only SQL preflight for the missing `league_seasons` / `creator_leagues` tables and a safe schema-cache refresh instruction. It does not create or seed fake records.
- **Credential safety:** `backend/.env.example` now uses placeholders instead of secret-looking credential values. If those prior values were real and have been committed/shared, rotate them with their providers before further production use.

## Not claimable as fixed from source tests alone

Live backend deployment, Supabase migration state, PayPal OAuth/account credentials, PayPal capture/webhook behavior, authenticated feature flows, and real-device responsive layout still require verification in the user's actual services. The working Create Team feature is preserved; no existing team or standings data is seeded or reset.
