# Creator Hub Creator Network — Manual Installation (Release 3.3.0)

This is the complete source tree for the existing project `ravaunrichards/creator-hub-live`, branch `main`. It is not a new project or a patch-only update. No remote GitHub/Supabase/deployment changes are made by this package.

## Before touching the project

1. Back up the repository working tree and database.
2. Preserve private `.env` files, local host settings, keys, custom changes and user-created source files separately. Do not replace live secrets with `.env.example` placeholders.
3. Extract the ZIP and review/merge the contents of `creator-hub-live-main/` into your existing repository. Review conflicting same-name files; do not erase personal configuration.
4. Read `docs/RELEASE-3.3.0.md` and `docs/FINAL-VALIDATION-REPORT.md` before deploying.

## Database migration sequence

1. Run `database/diagnostics/league_schema_preflight.sql` in the SQL editor for the exact Supabase project connected to your backend. Keep the output. You may also run `database/diagnostics/full_supabase_inventory_audit.sql` for a broader SELECT-only inventory of objects, columns, keys, indexes, RLS policies, privileges, RPC definitions, triggers and migration history.
2. Confirm the canonical base schema (`0001`, `0003`, `0004`, `0006`, `0008`) and required D5 division catalog exist. Review `0015` and `0016`; `0014_creator_league_server.sql` belongs to the separate Creator League model.
3. Review `0017_team_schema_compatibility_repair.sql`. Do not apply it if its prerequisites do not hold (notably the current `teams.points` field used by its index). The broader `0018_teams_schema_convergence.sql` covers that field and missing API columns, but still needs `profiles`, `teams`, `team_members`, `leagues` with D5, `league_seasons` and `league_standings`. Apply only if the preflight confirms the prerequisites. If 0017 is already applied, 0018 is written to converge overlapping fields.
4. Review `0019_league_operations_and_payouts.sql`, then apply only if all league, event, wallet, ledger and withdrawal prerequisites match. It stops if numbered fixture identities are ambiguous or existing saved payout rows have no usable destination. Do not fix these by deleting rows or inventing emails.
5. Review `0020_wallet_gift_schema_and_security.sql` against the full inventory. Apply only when wallet, coin/diamond ledger, gift catalog and gift transaction prerequisites match. It stops rather than zeroing NULL/negative existing balances or guessing ownership. It also restricts wallet/gift SECURITY DEFINER functions to `service_role`.
6. After a reviewed migration transaction commits, execute `NOTIFY pgrst, 'reload schema';`.
7. If the SQL errors, stop. Record the full SQL error and preflight output; do not repeatedly rerun migration scripts against an unknown state.

Do not blindly rerun all migration files from the beginning. Use the project's real migration history plus the preflight output.

## Backend and website

- Website: publish the existing `frontend/` directory as the static root.
- Backend: configure and deploy the existing `backend/` directory as a Node 20+ service (`npm install`, `npm start` in that directory).
- These are separate deployments. A successful static-site publish will not deploy backend route code or run SQL migrations.
- Confirm the frontend's API base URL reaches the backend you deployed; verify CORS allows the actual frontend origin.
- Backend credentials remain in hosting environment variables. Never place Supabase service-role keys, PayPal secrets, JWT keys, LiveKit secrets or webhook secrets in browser assets.

## Checks before deploying

From the repository root:

```bash
npm run check
npm run repair:contracts
```

Deploy only if checks pass. Local tests are not live service verification.

## Verify after deployment

1. `GET /api/health` reports `backendRelease: "3.3.0"`.
2. `GET /api/config/public` reports the selected PayPal environment (`live` or `sandbox`), not `invalid`.
3. Test Teams while authenticated and compare the original database error to the preflight result if a failure persists.
4. An admin creates a season with the intended real start/end date-time. The system does not invent season dates or automatically make one active.
5. Verify fixture generation, score entry/correction, fixture cancellation, standings, and finalization guards using test records in the target environment.
6. Use a PayPal sandbox account before a live transaction. Verify checkout, capture, webhook and wallet reconciliation end-to-end.
7. Test payout email save, payout request, the rejected-request refund, and the admin's manual payment-recording workflow.

Health/release markers confirm which service code responds and what normalized environment it reads. They do not prove the database migration has run or a transaction succeeded.
