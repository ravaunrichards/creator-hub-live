# Creator Hub Creator Network — complete coordinated source replacement

This ZIP contains the existing repository structure with the Teams interface, backend route dispatch, database migration, and browser-to-Android web asset synchronization integrated in the actual project files. It is intended for manual installation into the existing `ravaunrichards/creator-hub-live` project. No GitHub repository, Supabase database, or deployment was changed by preparing this package.

## Apply manually

1. Back up your current repository and Supabase database. Preserve any local-only configuration and custom edits.
2. Review `database/migrations/0013_wallet_package_contracts.sql`, `0014_creator_league_server.sql`, and `0015_teams_backend_complete.sql` against your actual migration state. Apply only migrations that are not already applied, in order, and stop if preflight assumptions do not match the live schema. Do not blindly rerun them.
3. Install the complete source tree from this ZIP into your existing project, preserving environment secrets outside source control. Do not commit `.env` files or signing/private keys.
4. Set backend environment variables using `backend/.env.example`; keep the Supabase service-role key and PayPal/LiveKit secrets on the server only.
5. Run `npm run teams:check`, `npm run check`, `npm run repair:contracts`, and `npm run backend:test` from the repository root.
6. Deploy manually only after local checks pass, then verify with real test accounts.

## Teams functionality included

- Team list/search and member counts from the backend API.
- Full create/edit forms for name, description, parish, logo URL, badge URL, maximum members, and recruiting status.
- Team details, roster, join/leave, owner-only edit, and owner-only member removal.
- Server-authenticated identity and service-role database writes.
- New teams start in division D5; numeric level 1–50 is not presented as league progression. Division and standings remain under the league system.
- Database functions create teams and owner membership atomically and enforce membership capacity under row locks. Existing owner membership roles are not overwritten by the migration backfill.

The existing team-division standings endpoint `/api/leagues/standings` is now connected to the server. The creator-specific league API module and migration are also included and registered in the existing backend. They remain separate from the established `leagues` / `league_seasons` / `league_matches` / `league_standings` division system; this package does not silently merge those schemas. The creator-specific league API still needs end-to-end testing against the actual Supabase project and PayPal sandbox, and this package does not claim that those external services have been tested.

## Validation boundaries

Automated checks validate syntax, source contracts, required files, secret-pattern scanning, and frontend/Android web-tree parity. They do not prove production credentials, Supabase migration state, PayPal OAuth, deployed API reachability, or real-device rendering. Test those in your own environment before declaring production readiness.
