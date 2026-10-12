# Creator Hub Creator Network — Database Contracts

## Existing migration chain

The canonical baseline has these migrations, in order:

`0001_identity_social.sql` → `0002_content_social.sql` → `0003_wallet_payments.sql` → `0004_live_social_systems.sql` → `0005_rls_policies.sql` → `0006_seed_config.sql` → `0007_payment_idempotency.sql` → `0008_server_authoritative_leagues.sql` → `0009_live_pending_state.sql` → `0010_rls_hardening.sql` → `0011_user_settings.sql` → `0012_live_chat_messages.sql` → `0013_wallet_package_contracts.sql` → `0014_creator_league_server.sql` → `0015_teams_backend_complete.sql` → `0016_official_division_tiers.sql`.

Migrations `0017`–`0020` are forward-only repair/expansion migrations for manually reviewed existing deployments. Do not run the entire chain blindly on a database that may already have it.

## New repair sequence

1. Run `database/diagnostics/league_schema_preflight.sql` first, against the database your backend actually uses. `database/diagnostics/full_supabase_inventory_audit.sql` is also included from the earlier Supabase audit package; it is a read-only inventory of schema objects, column definitions, constraints, indexes, RLS, grants, RPCs, triggers, extensions and migration history.
2. Review and apply `0017_team_schema_compatibility_repair.sql` only if its prerequisites including `public.teams.points` already hold. If that older migration isn't applied and its preconditions don't hold, do not force it; `0018_teams_schema_convergence.sql` is the broader convergence migration. 0018 needs existing `profiles`, `teams`, `team_members`, `leagues` with D5, `league_seasons` and `league_standings`.
3. Apply `0019_league_operations_and_payouts.sql` only after its required league events/matches, wallet, diamond ledger, withdrawals and D5 catalog have been verified.
4. Review/apply `0020_wallet_gift_schema_and_security.sql` only after the wallet, coin/diamond ledger and gift tables pass its preflight. It stops for ambiguous financial rows and restricts SECURITY DEFINER wallet/gift RPCs to the backend service role.
5. Reload PostgREST schema cache after successful, reviewed SQL commits using `NOTIFY pgrst, 'reload schema';`.

Migrations stop rather than fabricate core identity records, season dates, payout destination addresses or ambiguous fixtures. Review data by primary key and resolve safely if a migration tells you to stop.

## Important contracts

- `public.teams.description` and the current Teams API fields must exist for the current backend. Migration 0018 adds missing supplemental fields and preserves existing values where possible.
- `teams.level` is a retained legacy field only. Competitive division membership is one of A1–A3, B1–B5, C1–C5 or D1–D5 and is controlled through `division_code` plus season standings.
- D5 is the entry division for new teams. Promotion/relegation is processed during guarded season finalization; no manual Level 1–50 progression controls league placement.
- Team standings/matches use `leagues`, `league_seasons`, `league_standings`, `league_matches` and `league_events`.
- The TikTok Creator League uses separate `creator_leagues`-family tables. Do not treat it as interchangeable with the 18-division team system.
- Wallet balances are modified by server-side database functions and audited ledger entries. Creator payout requests use `diamond_withdrawals`; rejection refunds are idempotent.
- `paypal_payout_info` contains the creator's saved PayPal email; payout requests snapshot that destination into the withdrawal record. PayPal transfer and transaction proof are not inferred by database status alone.

## RLS and verification

The repository contains RLS migrations and server-only function grants, including the forward wallet/gift RPC hardening in 0020. Static tests are not a substitute for verifying effective RLS, grants, schema/function existence and PostgREST visibility in the target Supabase environment. No SQL in this package was executed against the owner's live database.

## No fake business records

The repair migrations do not create fake profiles/teams, league seasons, fixture scores, wallet balances or payment outcomes. Platform configuration seeding in `0006_seed_config.sql` is distinct from fake user/activity seeding.
