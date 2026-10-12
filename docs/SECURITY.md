# Security guide — Creator Hub Creator Network 4.0.1

## Credentials

- `SUPABASE_SERVICE_ROLE_KEY`, PayPal client/webhook secrets, LiveKit API secret, JWT/signing secrets and provider access tokens belong only in private backend environment settings.
- Browser `config.js` may contain the Supabase public publishable/anon key and public API/project URLs; it must not contain a service-role key or provider secret.
- Never write secrets to issues, source commits, client logs, screenshots or this package. Rotate a credential if it has been exposed.

## Accounts and authorization

- Backend routes validate the Supabase access token and active account status.
- Migration 0024 tightens allowed profile UPDATE columns so a browser cannot self-edit admin/role/account-state fields, restricts browser SELECT to explicitly allowed profile columns (the internal admin flag is retrieved with an owner-scoped function), and places active-account conditions on selected RLS policies. Follow/like/comment counter triggers run as controlled SECURITY DEFINER routines with a fixed search path so column grants do not break counters.
- Before applying migration 0024, compare all replaced policy/function names and effective privileges against the live schema. Confirm auth/session behavior using disposable test accounts.
- Deactivation does not invalidate every already-issued JWT instantaneously; database RLS and backend status checks are included to block subsequent use. Verify both in target deployment.
- Account deletion is destructive and constrained by real FK cascade rules. Audit transaction retention, dispute handling and legal requirements before enabling it for regular users.

## Payments and LIVE

- PayPal order creation/capture and coin credit stay server-authoritative and use idempotency. Do not mark wallet funds credited based on a browser redirect alone.
- Payout requests do not mean a PayPal transfer has happened. Mark transferred only when the actual external transaction is confirmed and its reference stored.
- LiveKit credentials and token signing stay backend-only; tokens should grant only the necessary participant permissions.

## Data and moderation

- Mission rewards require real configuration and manual fulfillment; the website does not transfer rewards automatically.
- Verification requests are private; only approved minimal badge records are publicly displayed.
- Do not ask users to host identity documents at public URLs. Verification requires a reviewed secure evidence process before being treated as production-ready.
- The browser account export is a bounded, partial export and clearly reports when individual sources failed.
- Terms and privacy documents are draft product copy until legally reviewed.

## Security validation

The source scan is a useful hygiene guard, not a penetration test. Manually test effective database grants/RLS, admin authorization, auth expiry, data isolation, CORS, SSRF/input constraints, storage ownership, provider webhook signature checks, and account deletion against a staging environment before public release.
