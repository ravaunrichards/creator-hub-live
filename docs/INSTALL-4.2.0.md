# Creator Hub Creator Network — Full coordinated source package 4.2.0

This ZIP is a full source replacement package for the existing project, not a patch-only installer. It includes the website, backend, database migrations, Android wrapper with synchronized web assets, tests, docs, and iPhone-friendly PWA entry file at `frontend/index.iphone.html`.

## One-time manual installation
1. Back up the current repository and keep approved release 4.0.2 untouched as the rollback copy.
2. Extract this ZIP into a separate folder and inspect `frontend/config.js` and `backend/.env.example`; do not copy secrets into public frontend files.
3. Install dependencies with `npm install` in `backend/` (and use Node 20+).
4. Run `npm run check` from the project root.
5. Review database migrations in order through `0025_live_guest_request_workflow.sql` against the actual Supabase migration history and backup before applying any new migration. Do not run them blindly against production.
6. Configure Render/LiveKit/Supabase/PayPal using the environment checklist in `docs/DEPLOYMENT.md`; deploy only after staging smoke tests.
7. Build the Android wrapper using the supplied Gradle project. Existing APK files are preserved as historical artifacts; this ZIP does not claim they were rebuilt or signed from the updated source.

## Scope of this package
- Real native gift buttons using database-backed prices; gift transactions remain server-authoritative through `send_gift`.
- Host-approved guest request/accept/reject/remove workflow and accepted-guest publishing authorization.
- Mobile LIVE layout refinements, hidden-state CSS, cache invalidation, synchronized Android web assets, and an iPhone-friendly web entry point.
- Preserves existing social, community, creator, team/league, wallet/PayPal, accessibility, account, settings, course and other existing files present in the source release.

## Important limits
This is source code plus tests and deployment instructions, not a deployment. The package cannot verify the live Render service, production Supabase schema/data, live credentials, physical camera/microphone behavior, PayPal settlement, or a newly signed Android APK in this environment. The existing schema history is included; production database changes require a backup and preflight. A static contract passing is not equivalent to end-to-end acceptance.
