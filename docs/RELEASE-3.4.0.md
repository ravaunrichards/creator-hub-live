# Creator Hub Creator Network — Coordinated Full-Source Release 3.4.0

Release date: 12 October 2026  
Repository: `ravaunrichards/creator-hub-live`  
Source baseline: `main` commit `6dc200823be3ef24821149a1e459e17c212d3a36`

## Scope

This is a full-tree continuation of the existing application, not a new/demo project and not a patch-only bundle. It keeps the existing frontend/backend/database/release layout and mirrors the frontend source into the repository's packaged web-asset tree for consistency.

The coordinated changes include:

- Compact, responsive layout settings, smaller-screen navigation, light/dark/system appearance, accessibility scale/contrast/reduced-motion options, and language/voice preferences.
- Social feed reads the established `posts.caption` and `posts.media` contract; creator discovery/search/hashtag/sound links; post creation; supported public photo/video upload; likes, comments, saved posts, reposts, reporting, account profile follow/unfollow and direct messaging where schema/policies support it.
- Notifications reflect real follow/like/comment/message events through migration-backed triggers; no test engagement is inserted.
- Creator Academy content for creator foundations, short-video storytelling, LIVE production and safety, analytics, payment safety, and community wellbeing; quiz/review and per-account progress sync after migration 0021. The learning record is not an accredited qualification.
- Currency conversion for the currencies provided by the external rate service; external translation/dictionary lookups; bundled phrasebook; browser speech/navigation helper; directions link and opt-in location/compass utility; local accessibility preferences.
- Offline-only Memory Match, Minesweeper, 2048, Klondike Solitaire and Pattern Bakery. These games do not invent coins, prizes or competition points.
- Creator Center overview, private analytics from stored creator records, honest LIVE session history, real scheduled-LIVE records with in-app notifications, activity-based public creator rankings, and sent/received gift history from the verified ledger. Scheduled LIVE entries do not start a stream automatically.
- Creator-owned subscription-tier metadata with active/inactive controls and subscriber history display. Recurring subscription checkout is intentionally disabled until a real payment provider, verified webhook, cancellation and refund flow are implemented; no subscription payment is simulated.
- Database-backed account/privacy/notification settings, read/write checks, private-account/block-aware post visibility, report submission with admin-only report review, and public media upload through a reviewed public Storage bucket. Media posts are therefore restricted to public audience until private media delivery is implemented.
- PayPal coin catalogue is read from the backend and uses the existing `coin_packages.price` column, rather than `price_usd`. The backend rejects invalid prices, requires a backend `FRONTEND_URL` or `PAYPAL_RETURN_URL` for the Orders API return/cancel redirect, and serves active USD packages through `GET /api/wallet/packages`.
- Updated tests for source parity, frontend JavaScript syntax, security scanning, teams/league contracts and payment-flow contracts.

## Read before deploying

1. Back up the production database and review `database/diagnostics/feature_release_3_4_preflight.sql` plus `database/diagnostics/full_supabase_inventory_audit.sql` and `database/diagnostics/league_schema_preflight.sql` against the exact production project.
2. Compare the real Supabase migration history and schema with migrations 0001–0020. Do not rerun the full chain blindly or apply schema compatibility migrations without review. Earlier inspection found missing team columns, `public.user_settings`, `public.paypal_payout_info`, and some league/payout routines. Reconcile existing migration drift in a controlled order before applying 0021/0022.
3. Apply `database/migrations/0021_social_academy_conversations.sql` only after the identity/social prerequisites and policies have been reviewed. It adds `course_progress`, a checked direct-message creation function and notification triggers.
4. Apply `database/migrations/0022_creator_media_storage.sql` only after reviewing the production Storage setup and policies. It creates a **public** `creator-content` bucket restricted to each authenticated user's UID-prefixed path. The website therefore permits media uploads only for public posts; it intentionally blocks private/follower-only posts with media until private storage and signed-URL delivery are implemented.
5. Apply the reviewed `database/migrations/0023_settings_schedules_analytics.sql` for account settings, privacy enforcement, saved LIVE schedules, follower in-app reminders, creator metrics, creator rankings and membership tier policies. Review its policy/function changes against actual production schema before applying.
6. Review `.env.example` and set Render backend values manually. `PAYPAL_RETURN_URL` is not a field in PayPal's Apps & Credentials screen; backend `FRONTEND_URL` is an accepted fallback and must be the deployed website origin. `PAYPAL_ENV` must be exactly `live` or `sandbox`. The matching Client ID and Secret are obtained from the same PayPal environment. Never put the client secret or service-role key in frontend config.
7. A webhook endpoint exists in the backend at `/api/payments/webhook`. If you want verified webhook processing, register that exact deployed HTTPS route with PayPal and store the resulting webhook ID as `PAYPAL_WEBHOOK_ID`; do not invent a URL or webhook ID. For a minimal checkout test, confirm the server-side order-approval and capture flow first.
8. Do not mark historic pending payment rows as paid/credited without reconciling each order against PayPal. A browser return or approved order alone is not proof of a successful capture.
9. TikTok-specific account data and publishing must remain disabled unless you supply approved TikTok developer app credentials/scopes and complete any applicable permission review. This release does not fake TikTok authentication, creator statistics, auto-posting, or external platform results.

## Install path

Use `docs/INSTALL-3.4.0.md`. This bundle is for the existing repository's manual update workflow. Install source and migrations manually; then run the checks, deploy frontend/backend from their established Render roots, and perform live acceptance checks with your own credentials. No GitHub, Render or Supabase production resources were changed by preparing this archive.
