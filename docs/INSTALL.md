# Creator Hub Creator Network — Manual Installation

This is the complete coordinated source tree for the existing `ravaunrichards/creator-hub-live` project. It is **not a patch**. Preparation did not change GitHub, Supabase, or any deployment.

## Install in 5 steps

1. **Back up** the current repository and database. Keep your local environment files and any uncommitted work safe.
2. **Extract this ZIP** and copy its `creator-hub-live-main` contents into your existing repository working folder. Review any local changes before replacing same-named files. Do not upload secrets or private keys to GitHub.
3. **Check database migration status** before applying anything. The new `database/migrations/0016_official_division_tiers.sql` updates only the existing division catalog labels and ranks. Apply it only after migrations `0006` and `0008` are already present. Do not rerun older migrations blindly.
4. From the repository root, run `npm run check`, `npm run teams:check`, `npm run backend:check`, `npm run backend:test`, `npm run repair:contracts`, and `npm run sync:android-web`. Install backend dependencies first if required.
5. Review failures, then commit/deploy manually only when you are ready. Test with your own accounts and current environment.

## Official division hierarchy

Lowest to highest: D5 Bronze III; D4 Bronze II; D3 Bronze I; D2 Silver III; D1 Silver II; C5 Silver I; C4 Gold IV; C3 Gold III; C2 Gold II; C1 Gold I; B5 Platinum IV; B4 Platinum III; B3 Platinum II; B2 Platinum I; B1 Diamond IV; A3 Heroic; A2 Master; A1 Grandmaster. Legacy code `A` is retained for database compatibility but is not an official competitive division. The migration does not move teams or fabricate standings.

## Important limits

- A passing source test does not prove live API, PayPal OAuth, Supabase schema, deployed website, or real-device behavior.
- Keep Supabase service-role credentials, PayPal client secrets, and other private keys on the backend only. Use `backend/.env.example` as the variable-name reference.
- Do not apply migrations until you have checked the actual live schema and migration state.
- Use real records only. No sample users, teams, match results, balances, or standings are added by the division catalog migration.
- If a test fails, keep the output and resolve that failure before claiming the affected feature works.
