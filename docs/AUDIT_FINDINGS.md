# Source audit and correction record

Target: existing repository `ravaunrichards/creator-hub-live`, branch `main`. This ZIP is a manually installable local source package; it has not changed GitHub, Supabase, or deployment.

## Corrections integrated in this package

- Added the missing `/api/leagues/standings` backend handler used by the existing Leagues page; this was absent from the previous server route table.
- Corrected the headless route test so it loads the actual `pages-teams.js` module instead of passing on the older placeholder Teams route.
- Added executable team-league route tests for active season data, an honest empty state, and missing-schema diagnostics.

- Connected the existing Teams route module into the backend server and enabled the required `PATCH`/`DELETE` CORS methods.
- Loaded the existing Teams page in the frontend entry point.
- Kept permanent numeric team level separate from league division placement.
- Added the official 18-division tier catalog migration (`0016_official_division_tiers.sql`) and labels in the league page.
- Added root source hygiene checks and a league hierarchy contract check.
- Synchronized the frontend source tree with the bundled web assets and checked parity.
- Replaced patch-oriented installation directions with full-source manual installation steps.

## Still requires user-side or service-side verification

- Supabase migration history and live schema must be checked before applying any migration. The migration does not create sample teams or results. The missing-table error still requires a user-side database migration if preflight confirms the table is absent.
- PayPal live OAuth, order capture, webhooks, and wallet reconciliation require real environment configuration and service tests.
- LIVE publishing/playback, deployed API reachability, account workflows, and responsive rendering on actual phones/tablets/desktops have not been proven by static source checks.
- Creator-specific leagues (`creator_leagues`) remain a separate schema from the team-division system. Verify that migration `0014_creator_league_server.sql` is applied before using those endpoints.
- The four planned season names are documented, but this package does not seed fake active seasons or match results.

## Data integrity notes

The division migration updates catalog labels and ranks only. It does not change team division assignments, scores, match results, balances, or historical standings. Legacy code `A` is retained as a compatibility row and marked non-competitive; the official competitive range is D5 through A1.
