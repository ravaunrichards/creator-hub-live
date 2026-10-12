# Creator Hub Live — Consolidated LIVE Room Update v1

**Delivery type:** manual-install overlay for the existing CHL repository. This is not a replacement project and it does not modify your live GitHub, Render, Supabase, or Android release.

## What this update changes

- Adds the curated 90-item CHL gift catalogue to migration `0013`, preserving the supplied coin prices, emojis, and order. Jamaica/parish gifts use the proposed `YARD TINGZ 🇯🇲` category and names documented in the catalogue seed.
- Adds the 52-level gifter progression thresholds, the four agreed badge categories (Visiting Supporter, Dedicated Supporter, Elite Supporter, Legendary Supporter), achievement definitions, ledger-based recalculation, and reversal-aware eligible-spend accounting.
- Adds server-authoritative catalogue/progress endpoints, a capped combo-send endpoint backed by a database transaction, idempotency, a strict creator-diamond payout guard, room interaction counters, viewer presence, guest invitations/controls, and host-managed room moderators.
- Reworks the LIVE gift panel to show server-returned catalogue rows rather than placeholder gifts; adds compact category navigation, quantity selection, badge explanations, team/competition preview, room controls, layout presets, gift effect/sound controls, reduced-motion support, and tap/share counters.
- Synchronizes the changed frontend assets into the Android WebView asset tree so website and packaged web assets use the same source files.
- Adds CHL-specific static contract checks and updates stale test assertions that no longer matched the current LiveKit contract.

## Important launch blocker — creator diamond conversion

The gift catalogue migration seeds each gift with `diamond_value = 0`. This is intentional and **must not be mistaken for a completed creator payout setup**. Neither the UI, API, nor SQL send function permits a gift send while its creator-diamond conversion is unset. That prevents coins being debited without the recipient receiving the configured creator credit.

Before enabling gifting, the owner/finance administrator must approve the coin-to-diamond/payout mapping, set a validated positive `diamond_value` for every active gift using a trusted administrative procedure, and run test transactions in a non-production environment. This update does not invent an exchange rate, does not generate creator balances, and does not certify the accounting/tax model. Keep gifting disabled until those checks pass.

## Manual installation on an existing project

1. **Back up first.** Download the current repository branch and take a Supabase database backup. Keep both unchanged as rollback copies. Test against a staging project if possible.
2. Unzip this update at the root of your existing repository, allowing the listed overlay files to replace their counterparts. This package is deliberately a focused overlay, not a substitute repository. Review the diff before committing/deploying.
3. Apply `database/migrations/0013_gifter_levels_catalog_and_live_tools.sql` to the existing database **after migrations `0001` through `0012`**, exactly once, and only after inspecting it and taking the backup. Stop on any SQL error; do not continue to a deploy with a partially applied migration.
4. **Do not re-run the historical `0003_wallet_payments.sql` on an existing database.** The package includes a revised copy under `fresh-install-only/database/migrations/0003_wallet_payments.sql` for brand-new database installation only. Its path is intentionally separate so extracting the ZIP does not overwrite the repository’s migration `0003`.
5. From the repository root, run:
   - `npm run sync:android-web`
   - `npm run check`
   - `npm run repair:contracts`
   - `npm run backend:check`
   - `npm run backend:test`
6. Deploy the updated frontend and backend from the **same reviewed source revision**. Keep existing environment variables and secrets in their current secret stores. Never copy server-only credentials into frontend configuration or this ZIP.
7. In staging, check sign-in, room opening/closing, host publish permission, guest invite/accept/reject/remove, moderator add/remove, viewer presence, taps/shares, gift catalogue loading, progress badges, and ledger balances. Test concurrent/duplicate gift requests and payout reversals before production.
8. Rebuild and sign Android from the included Gradle project with your own existing signing key. The web assets are synchronized in this update, but **this package does not include a newly built or newly signed APK**.

## What was tested here

The source package’s local automated checks passed:

- `npm run check`: **83 passed, 0 failed** in structure, required-file, frontend/Android asset parity, backend syntax, public-client secret-pattern checks, and version checks.
- CHL-specific gift/progression/API/UI static contracts: **21 passed, 0 failed**. These confirm 90 gift rows, 52 levels, the four exact badge categories, safety guards, combo RPC, and feature wiring in source.
- `npm run repair:contracts`: passed, including LiveKit gates, Android parity, settings, chat, wallet, and gift source contracts.
- `npm run backend:check`: passed; reported 65 browser routes registered, 69 route checks, 19 frontend files scanned, and 18 canonical endpoint strings.
- `npm run backend:test`: passed route checks, 3/3 backend JavaScript syntax checks, and LiveKit publish-source/room contract checks.

These are **static/source-level automated checks**. They are not a live deployment or end-to-end integration certification. PostgreSQL did not execute the migration in this environment. No real Supabase database, live PayPal account, Render service, browser/WebView instance, camera/microphone, second participant, or physical Android device was available for live verification here. Do not treat a passing local check as proof those external integrations are configured.

## Honest limitations still remaining

- **Gift motion fidelity:** the update uses lightweight, tier-aware UI effects and synthesized sounds with queue/concurrency control; it does not yet contain custom, cinematic 3D/Lottie/video animation assets for all 90 gifts. The effects are not a substitute for a separately art-directed asset library.
- **Economy setup:** all gift `diamond_value` fields start at zero; sending remains blocked until the approved mapping is configured and validated.
- **Android release:** WebView assets are synchronized; no new APK was built, installed, or signed with the production key.
- **Runtime integration:** SQL execution, Supabase RLS/runtime behavior, live gift transactions, WebRTC, sound playback on actual mobile browsers, and real-device responsiveness need staging validation.
- **Competition preview:** the room preview reads existing active league/season/match data where present. This update does not fabricate standings or deliver a new league management workflow; an empty backend produces an honest empty state.
- **Existing environment:** current Supabase/LiveKit configuration, PayPal OAuth, production secrets, or deployment health are not modified or certified by this overlay.

## Rollback

If a code-level check fails, restore the backed-up source files and redeploy the previous known-good revision. Database migrations are not automatically reversible: do not drop new tables or restore data casually. If `0013` fails partway, stop, preserve the error output, and review the exact database state with a PostgreSQL/Supabase administrator before retrying.
