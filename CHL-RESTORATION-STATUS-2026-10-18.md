# Creator Hub Live — Restored Requirements and Verification Status

## Official competitive structure

### Individual competitive ranks — lowest to highest

1. **Bronze I–III** — entry tier; learn the fundamentals.
2. **Silver I–III** — amateur tier; coordination and rotations.
3. **Gold I–IV** — intermediate tier; mechanics and execution.
4. **Platinum I–IV** — semi-pro tier; strategy, character skills and loadouts.
5. **Diamond I–IV** — elite tier; communication, utility and decision-making.
6. **Heroic** — professional tier for highly skilled squads.
7. **Master** — exceptional game sense, execution and team synergy.
8. **Grandmaster** — regional peak; Top 100–1,000.

### Team league divisions — separate from individual ranks

- A Division: A1, A2, A3
- B Division: B1, B2, B3, B4, B5
- C Division: C1, C2, C3, C4, C5
- D Division: D1, D2, D3, D4, D5

A1 is the highest team division and D5 is the lowest. Do not convert team division into an individual rank.

### CHL Creator League seasons

1. Season 1 — Opening Season
2. Season 2 — Rising Stars
3. Season 3 — Champions League
4. Season 4 — All-Star Season

## Required CHL feature scope

1. Gift Rankings — daily, weekly and monthly.
2. Popular LIVE — trending live creators.
3. Creator League — individual and team competitions.
4. Team Management — create teams, recruit members and track points.
5. Creator Statistics — gifts received, points, wins and match history.
6. Creator Battles — scheduled competitions between creators or teams.
7. Achievements & Badges — milestone rewards.
8. Challenges & Missions — tasks that earn eligible points under the rules.
9. Competition Schedule — upcoming matches and events.
10. Hall of Fame — past season champions and top creators.
11. Notifications — league updates, results and invitations.
12. Fair Play & Verification — verified results, disputes and anti-fraud controls.
13. Prizes & Rewards — official season prizes and reward history where applicable.
14. Discover Creators & Teams — search and explore participants.

## CHL match power-ups — rule-gated

- **Momentum Boost:** temporary boost during an eligible match; duration and effect are defined by CHL match rules.
- **Shield:** protects against a specifically defined in-match penalty/effect; cannot erase legitimate results or override a referee.
- **Time Boost:** optional time-related effect only in eligible formats; disabled where match rules do not permit timer changes.
- **Score Multiplier:** bonus for eligible match modes; must not automatically multiply official league points or alter standings.

These are requirements, not permission to award fake points, alter verified results, or imply a power-up is active before its rules and server-side validation exist.

## Source corrections included in this package

- Wallet module retains six coin packages, server-priced quote flow, payment-method selection, PayPal server-side capture, coin/diamond conversion, payout request/history and Android WebView parity.
- Go Live retains separate Video LIVE, Audio-Only LIVE and Screen-Sharing LIVE modes, mode-specific publishing permissions, camera flip, supported-camera zoom, mic/monitor controls and a dedicated screen-share LIVE end control.
- Teams page no longer displays fake “create form connected later” or “join request sent” success messages: create navigates to the real team creation form, and join calls the authenticated `/api/teams/:id/join` endpoint.
- Rank module includes the official Bronze–Grandmaster hierarchy, A1–D5 divisions and four exact season names.
- Web and Android WebView page copies are synchronized. Service-worker cache advanced to `chl-web-v3-3-11`; changed creator page reference is `6.0.14`.
- A stale regression assertion was corrected to test the stricter mode-specific LiveKit publish-source policy instead of requiring one obsolete literal expression.

## Current live database inspection

Project status was active/healthy on PostgreSQL 17.11. The database already has the core wallet, coin ledger, diamond ledger, gifts, live guest, teams, team-members, league-seasons and league-standings tables/columns; no broad schema rewrite was justified by this inspection.

- Coin packages: six active rows — 100/$0.99, 500/$4.99, 1,000/$9.99, 2,500/$24.99, 5,000/$49.99, 10,000/$99.99 USD.
- Gifts: 96 total rows, 90 active. The highest active gift is currently `Creator Hub Ultimate Universe` at **100,000 coins** in the database. The preserved immutable master specification says **1,000,000 coins**. This discrepancy is intentionally not silently rewritten here because gift price is production financial data and the complete authoritative price manifest must be reconciled before changing it.
- Gifter thresholds: 52 rows, levels 0–51, maximum threshold 1,000,000. The requested chart specification is 50 levels with Level 50 at 100,000,000 cumulative eligible coins spent. The full approved threshold curve is not present in this recovery package, so the live progression table was not rewritten with guessed intermediate thresholds.
- League data: `teams`, `team_members`, `league_seasons` and `league_standings` each currently contain zero rows. The database guard requires at least two real teams before a season can be activated. No dummy teams, memberships, seasons or standings were inserted; therefore an official standing cannot appear until real teams and verified league setup exist.
- `live_guests.status` currently permits `requested`, `invited`, `accepted`, `rejected`, `removed` and `left`; its current check constraint is named `live_guests_status_check`. The schema contains the guest workflow timestamps and controls. The earlier reported misspelled constraint name is not the current constraint name.
- One security hardening migration was already applied directly to Supabase on 2026-10-18: `secure_paypal_verification_trigger_function_execute_20261018` (version `20261018014733`). It revokes direct `EXECUTE` from `PUBLIC`, `anon` and `authenticated` on the trigger-only `reset_paypal_payout_verification_on_change()` function; post-change verification showed `anon` and `authenticated` cannot execute it. The same idempotent SQL is now included in `database/migrations/20261018014733_secure_paypal_verification_trigger_function_execute_20261018.sql` so the repository records the live change. The trigger continues to invoke it automatically.

## Verification and limits

- Frontend/static integration suite: **396 passed, 0 failed**.
- Recovery regression suite: passed, including Android/Web file parity across 330 web assets.
- Backend check and backend test suites: passed; 73 browser routes registered, 69 routes checked, 18 canonical endpoint strings verified, six backend source files syntax-checked.
- These are source/static/contract checks. Physical Android tests, real LiveKit publishing, PayPal live checkout, authenticated production API checks and actual browser viewport tests were not performed here.
- No GitHub source, Render service or deployed website was edited, and no new APK was built. The package is a local manual-install recovery; it is not a claim of production deployment or full end-to-end certification.
