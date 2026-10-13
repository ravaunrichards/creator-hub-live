# Creator Hub Creator Network — Manual Update 4.0.2

This continues the current website/PWA and Node backend in `ravaunrichards/creator-hub-live`; it is not a new project and is not automatically deployed.

## Included in this update

- Source/schema audit grounded in the current GitHub tree and read-only Supabase object/catalog queries.
- `database/diagnostics/chcn_live_repair_preflight.sql` to make schema presence, migration tracking, and selected financial-integrity checks visible without modifying data.
- A dependency-ordered migration plan for selected forward migrations.
- Appearance UI for Compact, Balanced, Spacious; Premium Dark, Clean Light, Follow Device; on-screen preview; local save; per-account `user_settings.appearance` sync via the new migration.
- Real Admin → Verification controls to grant or remove the Verified Creator badge under database RLS.
- Static regression coverage added to the root check script and consistent 4.0.2 asset/service-worker cache IDs.

## Known limits

The live database remains unchanged until manually installed. PayPal OAuth environment variables were not inspected; checkout is not production-verified. Automated PayPal payouts, AI recommendations, advanced editing/effects, audio-only LIVE and paid-subscription settlement remain separate selected enhancements rather than claims of this schema-repair update. Review `docs/CHCN-LIVE-REPAIR-PLAN.md` and `docs/VALIDATION-4.0.2.md`.
