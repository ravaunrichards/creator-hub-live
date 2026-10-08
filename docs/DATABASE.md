# Creator Hub Creator Network — Database

## Migration order

`0001_identity_social.sql` → `0002_content_social.sql` → `0003_wallet_payments.sql` → `0004_live_social_systems.sql` → `0005_rls_policies.sql` → `0006_seed_config.sql` → `0007_payment_idempotency.sql` → `0008_server_authoritative_leagues.sql` → `0009_live_pending_state.sql` → `0010_rls_hardening.sql` → `0011_user_settings.sql` → `0012_live_chat_messages.sql`

## Important contracts

- `live_sessions.id` identifies the Creator Hub database record.
- `live_sessions.room_name` is the authoritative LiveKit room name.
- LIVE status is `pending` → `live` → `ended`.
- `updated_at` is maintained for LIVE sessions.
- Wallet balances are changed through server-side SQL functions/ledger operations.
- PayPal capture crediting is idempotent.
- User settings are account-level and RLS-protected by `auth.uid()`.
- LIVE chat messages are persisted under `live_chat_messages` and sender ownership is enforced by RLS.

## RLS

The repository contains explicit RLS migrations. Static policy inspection passed. A live Supabase database was not available, so deployed RLS behavior is **UNVERIFIED**, not PASS.

## Seed data

`0006_seed_config.sql` seeds only platform configuration such as coin packages, league configuration and gift catalog. It does not create fake users, followers, posts, viewers, payments or balances.
