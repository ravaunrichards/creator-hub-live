# Local validation and manual production acceptance — 4.0.2

## Checks performed while preparing this package

- GitHub `main` source blob comparisons were read-only; current base files matched before local changes.
- Read-only Supabase catalog queries confirmed a partial schema and the missing objects documented in `docs/RESTART-AUDIT-2026-10-12.md`.
- Read-only wallet integrity checks: zero wallet NULL/negative rows; zero duplicate wallet owners; zero duplicate non-null idempotency keys in the checked coin, diamond and gift records.
- `npm run check` passed locally with 248 integration assertions, the backend route/syntax/LiveKit/Teams/league/PayPal/payout suites, 25 migration static checks, and 22 new appearance/verification assertions. See `LOCAL-TEST-RESULTS-4.0.2.txt` for the summarized output. Static checks cannot prove live database execution or visual UI behavior.

## Required manual acceptance after installation

1. Re-run `database/diagnostics/chcn_live_repair_preflight.sql` and ensure all selected migration prerequisites pass.
2. After applying migrations and schema refresh, verify `profiles.account_status/deactivated_at`, user_settings + appearance, live_schedules, team columns/RPCs, round_number, creator payout columns/RPCs, battles/missions/verification badge tables, and ranking/metric functions appear in `public` schema via the SQL Editor.
3. Verify the backend health/config routes report the expected existing deployment and version; inspect the Render deploy/logs in the user's own workspace.
4. Test authenticated requests in a non-production/test account or a controlled low-risk account: settings get/save; create/edit/join a team; server-calculated standings; metrics/rankings; battle invite state; mission claim; verification request; admin badge grant and revoke. Check RLS as both signed-in member and non-admin.
5. Payments: select PayPal via method selection; load package catalog; create one order; complete a buyer-approved capture; confirm a single successful payment and a single coin ledger credit. Repeat-safe checks must not duplicate credits. Do not fabricate/replay success in the browser.
6. Save/load PayPal payout email; submit a payout request only if a valid test balance exists; confirm one diamond reservation, one admin status transition, and a one-time refund on rejection. The current module manually records PayPal transfers; it does not execute PayPal Payouts API automatically.
7. Appearance: switch Compact/Balanced/Spacious and all three themes; check live preview, reload persistence on device, signed-in account sync across browsers, and local fallback if unavailable. Test small Android (360–400 CSS px), tablet and desktop. Verify no horizontal page scrolling and text remains readable.
8. Confirm network interruption/empty-data/error states, no duplicate submissions, and accessible keyboard/focus states.

## Not run in this package build

No Supabase migrations were executed; no GitHub file was committed; no Render environment variable/deploy/log was changed or read; no live PayPal transaction/OAuth was called; no LiveKit stream was run; no headless-browser/physical-device visual session was accepted. These remain production acceptance requirements.
