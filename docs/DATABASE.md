# Database migration and contract guide — 4.0.1

## Existing migration chain

The package includes the existing forward migration history `0001` through `0024`. Historical migrations must **not** be replayed blindly against a database that may already contain the project tables, policies, or functions. Inspect actual installation state first.

Run read-only diagnostics against the exact Supabase project used by the deployed backend:

- `database/diagnostics/full_supabase_inventory_audit.sql`
- `database/diagnostics/creator_community_preflight.sql`
- `database/diagnostics/league_schema_preflight.sql` for team league contract reconciliation
- `database/diagnostics/teams_backend_restart_preflight.sql` for safe Teams/base-schema checks

## Release 4.0.0 migration 0024

`database/migrations/0024_creator_community_account_controls.sql` is a forward-only migration. It requires the identity/social, content, settings, wallet/gift, conversation, LIVE and existing creator-metric infrastructure from prior migrations. It adds/updates:

- Profile account status/deactivation timestamp and active-account helper.
- Safer profile column grants and active-account RLS conditions across social writes, LIVE, messaging, notifications, media storage and settings.
- The signup user-metadata username contract and notification preference for battle activity.
- Persisted creator battle invitations/status, creator missions and manual claims.
- Private creator verification applications and public approved-only badge rows.
- Rolling day/week/month gift ranking RPC.

No fake profiles, posts, gifts, battles, mission definitions, verification badges, scores, payouts or wallets are inserted. The initial tables for mission/battle/verification features are empty until real activity/admin configuration occurs.

## Required preflight and application steps

1. Confirm the backend's Supabase project URL matches the target before running SQL.
2. Take a restorable database backup/export.
3. Run inventory and creator-community preflight SQL. Save the results.
4. Review table columns, FK rules, current policy names/definitions, function owners/grants, storage bucket policies, and the installed migration ledger. Check the prerequisites in the top of migration 0024.
5. Read the whole migration with your database administrator. It replaces or tightens named RLS policies and `handle_new_user`, `is_admin`, and `create_or_get_direct_conversation`. Confirm current names/contracts match; adjust safely if this deployment has drifted.
6. Apply 0024 only if it is not already installed and its preconditions are met. Do not apply it based only on file existence.
7. Verify the committed schema, policies, and function ACLs; run `NOTIFY pgrst, 'reload schema';` when needed, then restart/redeploy backend as your provider requires.
8. Perform tests with anonymous, normal, blocked, private, deactivated and administrator accounts.

## Historical league migrations

Migrations 0017–0020 were existing manual repair/expansion steps. Their prerequisites still matter. See `database/diagnostics/league_schema_preflight.sql` and `LEAGUE-RANKING-STRUCTURE.md`; do not assume a migration is required or safe merely because the file exists. Team league divisions (A1–A3, B1–B5, C1–C5, D1–D5) are distinct from the creator-created league subsystem.

## Deletion and financial retention

The account deletion endpoint deletes the Auth account. Cascades depend on real installed foreign keys, some of which may remove gift/payment ledger relationships. Before enabling permanently destructive self-service deletion, assess financial reconciliation, chargebacks, fraud/safety evidence and applicable retention obligations. Do not use owner/production accounts as deletion tests.

## Trust model

- Wallet/coin/diamond mutations must remain server/RPC-owned; do not expose service keys in frontend.
- Creator missions and claim status are reviewed manually; no automatic financial reward is sent.
- `public_creator_badges` should display only genuinely approved records; it does not validate third-party social-network verification.
- No SQL in this package has been run against the user's live database. SQL validity and RLS behavior must be established in a backup-backed staging/production-like database before production use.
