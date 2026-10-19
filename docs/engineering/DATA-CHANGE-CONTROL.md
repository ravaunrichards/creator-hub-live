# Database and data-change control

## Mandatory preflight

1. Confirm the exact Supabase project/instance and environment; never assume a similar project name is the target.
2. Read the live migration ledger and inspect actual tables, columns, constraints, indexes, functions, grants, and RLS policies relevant to the change.
3. Compare the proposed migration with both the committed migration directory and the live ledger. This repository has documented migration naming/order drift; a migration filename does not prove whether its contents were applied.
4. Search for duplicate migrations, existing columns/functions/indexes, dependent routes, policies, and data backfills.
5. Determine whether the change is additive, backfill-only, destructive, locking, or security-sensitive. Estimate row volume and lock risk.
6. Produce a backup/restore or tested compensation plan and the post-migration verification query.
7. Require explicit authorization before executing any production mutation.

## Migration standards

- Prefer small, forward-only, additive changes when practical.
- Give one unique timestamp/sequence and descriptive name; never reuse a version or renumber already-applied history to make the ledger look tidy.
- Make rerun behavior intentional. `IF NOT EXISTS` only prevents some duplicate-object failures; it does not prove that an existing object is correct.
- Declare columns, constraints, defaults, nullability, FK targets, indexes, RLS, policies, grants, triggers, and function changes deliberately.
- Do not add broad permissive RLS policies to make tests pass. Decide access table-by-table and role-by-role, using least privilege.
- Audit `SECURITY DEFINER` functions individually: ownership, `search_path`, caller authorization, execution grants and all call sites. Do not blanket-revoke or blanket-grant functions without dependency review.
- Index foreign keys when query/write patterns justify it, but assess write overhead, duplicate indexes and lock behavior. A concurrent index build has transaction restrictions; plan tooling accordingly.
- Avoid irreversible `DROP`, table rewrites, balance changes, bulk deletes, and FK cascades without explicit data-impact review.
- Keep seed data to configuration/reference data. Do not seed fake creators, messages, viewers, payments, balances, or gift transactions.

## Runtime authority and invariants

- Account, wallet, gift, diamond and payout mutations must use authorized backend/database operations and an auditable transaction record.
- Payment confirmation must be verified server-side; a redirect or client event is not proof of settlement.
- Use idempotency keys/constraints for retried payment captures, reversals, gift sends, and other financially meaningful actions.
- Keep configured gift catalog names/prices/order aligned with the approved CHL catalogue. Asset manifests are not a price authority. Preserve the current approved 90-gift catalogue and the `Creator Hub Ultimate Universe` price of 1,000,000 coins; do not introduce an older conflicting price cap from obsolete notes.
- Do not convert a schema discrepancy into a client-side fallback that hides the failure. Report the exact missing object/constraint and correct it at the authoritative layer.

## Apply and verify

- Use an approved migration runner or the explicitly chosen dashboard SQL path; never run SQL from an unreviewed archive blindly.
- Capture migration version, timestamp, environment, operator/approval and result without exposing credentials.
- Verify the intended object definitions, constraints, indexes, policy behavior and expected row-level outcomes.
- Execute tests as anonymous, normal authenticated, record owner, non-owner, and elevated roles where relevant.
- If verification fails, stop dependent releases and use the agreed recovery plan. Do not delete data or reverse ledger entries casually to make a check green.
- Update the migration inventory/docs only after observing the result. State separately whether a migration was packaged, applied, and verified.
