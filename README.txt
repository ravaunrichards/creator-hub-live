CREATOR HUB CREATOR NETWORK — NEXUS EDITION 6.0.2

Complete source recovery for the existing Nexus project, including the existing website/frontend, backend/API, 26-file local migration chain, Android wrapper source, iPhone web entry, PWA and recovered gift media assets. This is not a new demo app and has not been deployed to your live services.

Read START-HERE.txt first. Feature and setup documentation is under docs/. Run `npm run check` for the automated source, route, security-pattern, contract, migration-static, backend-unit and asset checks. Run `npm run studio:sync-android` to synchronize the Android WebView frontend, then repeat the checks.

The LIVE experience adds server-backed polls/voting, Q&A, reactions, gift-event history, host settings/moderators/analytics, and optional recording management through LiveKit Egress and private S3-compatible storage. Gift pricing and settlement remain database/server authoritative; the included manifest contains assets, not prices or coin-to-diamond conversion values.

Nexus migration 0026 is additive and must be validated against a backup and the actual target Supabase migration ledger/schema before applying. Historical migrations that reuse 0025–0029 must not be blindly appended. See docs/LIVE-ROOM-EXPERIENCE-NEXUS-6.0.2.md.

A headless Chromium smoke test confirmed the frontend booted and the host LIVE tools rendered without JavaScript errors or horizontal overflow at 360, 390, 768 and 1440 px using mocked API responses. Automated checks do not prove live Supabase/RLS, LiveKit recording uploads, PayPal settlement or device media behavior.

The historical APKs are preserved but no Nexus 6.0.2 APK was rebuilt or signed because Android SDK/Gradle tooling is unavailable here. The iPhone entry is a web file, not an IPA.
