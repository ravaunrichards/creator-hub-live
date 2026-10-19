# Creator Hub Live — Database & Migration Upgrade

## What was inspected

Read-only inspection of Supabase project `Creator-Hub-Live` (`txibryhznycmuqufnxvh`) on 2026-10-17, plus the current GitHub `main` migration directory. No SQL writes or migrations were applied to the connected project.

## Confirmed findings

- 66 public tables reported by the connected database; all reported tables had RLS enabled.
- Supabase migration history reaches `0054_restore_live_gift_recipient_rpc` (timestamp-based migration versions), while the repository migration folder inspected contains legacy, inconsistently numbered SQL files through `0047`, with duplicate numeric prefixes and different naming/order. This is migration drift and must be reconciled before relying on a clean replay from an empty database.
- Performance Advisor reports 55 foreign-key columns without covering indexes.
- Security Advisor reports 18 RLS-enabled tables with no policies. That default-denies access and may be deliberate for service-role-only data; this package does not add blanket policies.
- Security Advisor reports 7 SECURITY DEFINER functions executable by `anon` and 24 executable by `authenticated`, plus other policy/extension/auth findings. Function grants must be reviewed function-by-function, not globally revoked without understanding the frontend/backend call contract.
- Performance Advisor also reports 59 RLS init-plan opportunities, 9 multiple-permissive-policy findings, 5 duplicate-index findings and 13 unused-index findings. This package does not drop indexes or rewrite policy logic automatically.

## Included files

- `database/migrations/20261017020000_chl_foreign_key_index_coverage.sql` — additive `CREATE INDEX IF NOT EXISTS` statements for the 55 confirmed missing FK indexes.
- `database/diagnostics/chl_database_health_audit.sql` — read-only queries for FK index coverage, RLS-without-policy tables, exposed SECURITY DEFINER functions, indexes and migration history.
- `database/tests/verify_chl_fk_indexes.sql` — read-only verification of the index coverage added by this migration and a report of RLS tables requiring policy classification.

## Safety / rollout notes

- The migration is additive; it does not alter or delete data, change wallet/gift balances, modify existing RLS policies or change function grants.
- Regular `CREATE INDEX` can take locks and add write/storage overhead. Review table sizes and run in a low-traffic window. For very large tables, create indexes concurrently in a separately controlled operation because `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.
- Do not run this migration against production until the migration ledger and repository are reconciled and a current backup/restore path is confirmed.
- The repository migration history is not yet a reliable clean-install baseline. Do not rename/rewrite old migration files to make numbering look consistent: applied migration identities must be preserved.
- This package does not apply changes to Supabase, GitHub, Render, or the live site.

## Manual validation without Codespaces

1. Download and extract this ZIP.
2. In Supabase Dashboard, select the Creator-Hub-Live project and open SQL Editor.
3. Run `database/diagnostics/chl_database_health_audit.sql` first; save the output.
4. Review the migration and confirm migration-ledger drift has been reconciled before applying it.
5. If approved, apply the migration through the project's established migration workflow (not by blindly pasting the whole file into a live database without backup/maintenance planning).
6. Run `database/tests/verify_chl_fk_indexes.sql`; section A should return zero rows for the targeted columns.
7. Re-run Supabase Performance Advisor. Findings should be re-evaluated against the exact current schema; index changes alone will not resolve the security and RLS findings.

## Important limits

This is a database performance and migration-foundation package, not a full social schema rewrite. It deliberately does not invent separate social-platform tables, because CHL already has profiles, follows, posts, conversations/messages, live sessions/guests, wallets, ledgers, gifts, subscriptions, teams and leagues. Further schema changes should follow after the live/repository migration history and the RLS/function-grant findings are reconciled.
