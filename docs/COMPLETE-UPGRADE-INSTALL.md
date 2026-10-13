# Creator Hub Creator Network — Complete Coverage Upgrade 4.1.0

This is a manual-install enhancement for the existing repository `ravaunrichards/creator-hub-live` on `main`; it is not a replacement app and does not push to GitHub, run Supabase SQL, or deploy Render/LiveKit. Back up the entire checkout and Supabase project before use.

## Install order

1. Download and extract the ZIP. Open a local checkout of the existing `creator-hub-live` repository on `main`.
2. Run `node ./install-complete-upgrade.mjs /path/to/creator-hub-live` (Windows PowerShell: `node .\install-complete-upgrade.mjs "C:\path\to\creator-hub-live"`). The installer verifies source anchors, makes timestamped backups next to replaced files, and refuses to overwrite unrelated new files.
3. Review the diff and backup files. Confirm `database/migrations/0029_complete_social_live_gifting.sql` is the next unapplied migration. Back up the database, review the entire SQL file, and apply it manually to the correct Supabase project. **Do not deploy the backend/UI before the migration succeeds.** The migration stops if any of the 90 gift names is missing or duplicated; it never fabricates gift catalogue rows.
4. From the repository root run `npm run check`; it includes the new static contract checks. Also run `node --check frontend/src/pages-project-upgrade.js`, `node --check frontend/src/pages-room.js`, `node --check frontend/src/pages-extra.js`, `node --check backend/src/server.js`, `node --check backend/src/live-room-experience.js`, `node tests/complete-upgrade-contract.mjs`.
5. Only after checks pass, deploy backend and frontend through your existing procedures. Configure the static frontend service to publish the `frontend/` directory so the new gift assets exist at `/assets/gifts/...`.
6. Test with separate signed-in accounts: host, viewer, requester, accepted guest, gift sender/recipient, blocked pair, and message sender/receiver. The included test is static; it does not substitute for live Supabase/LiveKit tests.

## Changes included

- 90 distinct, locally supplied gift art SVGs, animated SVGs and gift-specific WAV chimes; exact approved name/price/emoji/tier metadata. The SQL preflight refuses incomplete/duplicated source gift rows. The API exposes their metadata without changing `send_gift` financial authority.
- Single-button collapsed gallery with eight tier/category tabs, accessible sound/motion preferences, on-screen LIVE gift cards showing sender, recipient, gift and confirmed coin value. Viewers retrieve actual gift transaction records through a room-authorized API endpoint; no fake transactions are seeded.
- LIVE share action, stage tap-to-heart recorded through the existing rate-limited reactions API, blue-left/red-right Multi-Guest icon and guest request/host accept-reject workflow. An accepted request creates an invitation; the guest must still accept the seat invitation before publishing, avoiding silent microphone/camera activation.
- Mobile More drawer linking to pages missed by the five-tab bar; own-profile shortcuts; a mutual-friends list and Unfriend; share on feed cards while retaining the existing Repost toggle.
- Message actions for copy, reply, edit (15-minute window), unsend for everyone, hide for me, report, search, mute and leave conversation, backed by additive RLS-controlled tables/column privileges. Clearing messages hides only the current user's view.
- High-contrast focus and mobile compact styles.
- Android WebView wrapper source and a manual GitHub Actions build workflow, discussed below.

## Gift animation/audio behavior

Each gift has its own unique static illustration, animated SVG file and WAV file under `frontend/assets/gifts/`. These are supplied local assets, not third-party URLs. UI creates valid same-origin HTTPS URLs at runtime when the site is HTTPS; viewers can turn sound off or reduce motion. Exact sound behavior must be verified after frontend assets are deployed.

## Android package

`android-wrapper/` is part of the existing project support. It packages the hosted website in an Android WebView; it does not make the backend self-contained or work offline for server-backed actions. This environment did not have Android SDK/build-tools installed, so this ZIP does **not** contain a compiled APK. The included `creator-hub-android.yml` can build an installable signed **debug** APK in GitHub Actions, or a signed **release** APK if you configure a persistent private keystore as GitHub Actions secrets. Store your own release keystore/password securely and retain it for every future update; never commit it to the repository.

For release signing configure secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; workflow input `website_url` must be your deployed HTTPS frontend. A debug-signed APK is installable for testing but is not interchangeable with a future release-signed APK. Camera/microphone file/capture permissions still need real handset testing. No APK can be guaranteed to work on every Android device/version.

## Items not safe to guess

- “Power count” does not map unambiguously to an existing field/metric in the inspected source. It remains unresolved rather than being mislabeled as viewers, likes, rank, or gifts.
- Automatic gifter-level award thresholds are not present as a verified source of truth in the inspected code. Badge artwork is included, but no invented coin-spend thresholds or automatic awards are enabled.
- Arbitrary custom coin purchase amounts remain blocked until the server has an approved pricing formula/package model. PayPal's currently configured USD packages remain server-authoritative; this update does not invent an exchange rate.
- Live end-to-end validation (real Supabase migration/policies, LiveKit video/audio/guest publishing, gift polling across separate viewer devices, PayPal capture, recording storage and physical Android tests) must be completed in your staging environment before production claims.
