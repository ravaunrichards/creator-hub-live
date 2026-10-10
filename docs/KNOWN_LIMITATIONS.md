# Known Limitations — Creator Hub Creator Network

Date: 2026-10-10

This document distinguishes code-level checks from real service/device validation.

## Not verified in this environment

1. **Android build and installation:** no Gradle wrapper, installed Gradle, Android SDK, or physical Android device was available. No APK is included in the corrected package.
2. **Live backend:** Supabase, Render, LiveKit, and PayPal endpoints were not exercised with production credentials.
3. **Database migrations:** migration files were inspected and updated, but they were not applied to the actual Supabase database.
4. **Camera/microphone:** LIVE media publishing, remote subscription, reconnection, and permission prompts were not tested on a device.
5. **Payments:** PayPal sandbox capture, webhook signature verification, ledger idempotency, and refund/reconciliation behavior were not run end-to-end.
6. **Signing identity:** the original keystore and APK artifacts were excluded. Confirm the actual Play Console signing configuration before any update.

## Product gaps not silently represented as complete

- Multi-guest invitation/approval and host/moderator guest controls are not implemented by this repair pass.
- Switchable LIVE layouts 1–4 are not implemented by this repair pass.
- This package does not certify every feed, messaging, course, creator analytics, payout, moderation, and administrative workflow as production-complete.

No placeholder control is being described as a working feature. Complete these items in a later tested implementation rather than assuming they work.
