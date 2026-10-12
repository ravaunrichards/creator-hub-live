# Release history

## 4.0.1 — Teams backend restart patch

Focused Teams database-error diagnostics, a read-only Teams schema preflight and updated installation/version labels. Created as a manual-install package from the last complete saved 4.0.0 website source because current GitHub `main` no longer contains the source directories. No remote changes or production migrations were made. See `RELEASE-4.0.1.md`, `TEAMS-BACKEND-RESTART.md`, and `RESTART-AUDIT-2026-10-12.md`.

## 4.0.0 — Creator Hub Creator Network website source release

Full website/backend/database source continuation for the existing `ravaunrichards/creator-hub-live` project, prepared for manual installation. Website branding/cache version aligned to 4.0.0; unrelated learning/academy, games and map/tool browser modules excluded; account/privacy/security settings expanded; username signup contract aligned to database trigger; account status/deactivation/delete service routes and forward-only migration 0024 added; creator battles are invitation/status-only; mission claims and verification require actual configuration/review; gift rankings use real recorded gift transactions; tests and installation/acceptance docs updated.

The ZIP does not deploy remotely. Live database migration behavior, provider credentials, checkout/capture/webhook, LIVE media, host/CORS state and physical-device rendering require the checks in `VALIDATION-4.0.0.md`.

Prior implementation notes and APKs are intentionally not bundled in this website-only release. Existing migration files through 0023 are retained as project history; migration 0024 is a new forward-only account/community-controls migration and must be preflighted before application. Do not replay prior migrations blindly.
