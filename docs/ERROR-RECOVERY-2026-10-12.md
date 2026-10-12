# Error recovery — Teams, League standings, PayPal

This is a coordinated full-source update to the existing Creator Hub Creator Network repository. It does not change the live site, hosting, GitHub, or Supabase automatically.

## 1. PayPal environment

In the backend service environment settings, set **one** of these values exactly:

- `PAYPAL_ENV=sandbox` when using PayPal Sandbox Client ID and Secret.
- `PAYPAL_ENV=live` when using PayPal Live Client ID and Secret.

Do not put an OAuth access token in the environment as a substitute for the Client Secret. The Client ID and Client Secret must come from the same PayPal environment. After changing environment variables or backend source, redeploy/restart the backend. The frontend's `PAYPAL_ENVIRONMENT` display setting does not configure the backend.

The normalizer accepts `production` and `prod` as aliases for `live`, and treats a blank setting as the safe `sandbox` default. Unknown explicit values remain errors rather than silently selecting an environment.

## 2. Teams and league diagnostics

This update makes the Teams and Leagues screens show the HTTP status/error code instead of hiding the underlying failure. The Teams API also returns a specific setup message for missing `teams` / `team_members` tables or the known team-creation RPC. The league API already returns a specific setup message for missing league tables.

If the message names a missing table/function, first inspect `database/diagnostics/league_schema_preflight.sql` and the existing migrations. Review prerequisites before applying a migration; do not blindly re-run every SQL file. After a schema change, refresh PostgREST's schema cache with `NOTIFY pgrst, 'reload schema'`.

If the message is `BACKEND_UNAVAILABLE`, a browser network error, or HTTP 404, verify that the deployed frontend's backend URL points to the deployed service and that the backend was actually redeployed from this source. A successful static-site deploy alone does not deploy the backend.

## 3. Manual installation order

1. Back up the current repository and copy any private environment values to a secure place (do not put them in the ZIP or Git).
2. Merge this ZIP's contents into the existing repository; do not create a new project.
3. Deploy the backend service from the repository's `backend/` directory and set its environment variables in the hosting dashboard.
4. Deploy the website from `frontend/`.
5. Check `GET /api/health`, `GET /api/config/public`, `GET /api/teams`, and (while signed in) `GET /api/leagues/standings`. The browser screens now show more of the actual response when one fails.

## Verification boundary

Automated source tests can validate route wiring and environment parsing, but cannot verify your live host, Supabase schema/policies, PayPal credentials, or production browser requests. Those must be checked after deployment.
