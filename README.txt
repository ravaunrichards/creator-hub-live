CREATOR HUB CREATOR NETWORK — MANUAL UPDATE PACKAGE 4.0.2
Existing project: ravaunrichards/creator-hub-live (main)

This package continues the existing Creator Hub Creator Network website/PWA and backend. It is a manual-install update, not a new project and not an automatic deployment.

What this update addresses:
- Read-only schema reconciliation plan for the missing Teams, account lifecycle, settings, rankings, schedules, payout-destination, community and badge objects found in the connected database audit.
- Appearance settings with Compact, Balanced and Spacious layouts; Premium Dark, Clean Light and Follow Device themes; visible live preview; local persistence and per-account synchronization when the appearance migration is installed.
- Admin controls to grant/remove the public Verified Creator badge (database RLS remains the authority).
- A read-only preflight SQL file and dependency-ordered manual installation/verification instructions.

START HERE: START-HERE.txt and docs/CHCN-LIVE-REPAIR-PLAN.md.
Database diagnostics: database/diagnostics/chcn_live_repair_preflight.sql. It is read-only.
Selected manual migrations: 0015, 0018, 0019, 0021, 0023, 0024, and 0025. Do not replay every historical migration. Migration 0020 was not included in the standard sequence because live read-only checks found its financial-integrity checks clean and its critical RPCs already restricted to service_role; inspect the preflight/security results before deciding whether it is needed.

No GitHub source files, Supabase database objects, Render configuration, PayPal account settings, or live deployment were changed by preparing this package. Static/local tests are not production acceptance. Supabase schema, RLS, PayPal environment/OAuth, hosting deployment, and real-device UI must be verified after manual installation.
