# Known limitations and production gates — 4.0.2

- **No live production validation was performed by this package build.** Supabase access/schema state, Render or other hosting state, actual PayPal OAuth/client credentials, PayPal webhook verification, LiveKit networking, and real browser/device behavior must be checked after installation.
- **Migrations 0015/0018/0019/0021/0023/0024/0025 are a reviewed manual reconciliation path and have not been applied here.** The actual database had no readable migration-history table. Back up and use the read-only preflight; do not run all historical migrations blindly.
- **Account deletion:** the API requests Auth-user deletion and database foreign keys determine cascaded deletion. Review actual schema, payment/gift ledger retention, dispute/fraud evidence, and Jamaican legal/privacy obligations before enabling permanently destructive self-service deletion. Test only with disposable accounts.
- **Data export is a partial account export**, bounded by explicit row limits and current browser-accessible records. It is not a legally certified full data portability package; media objects, all message bodies, all provider-side records, and all records beyond limits may be absent. Warnings are embedded when individual exports fail.
- **Connected accounts:** this page reports identities exposed by the current Supabase Auth session; it does not implement arbitrary provider linking/unlinking.
- **Two-factor authentication and full session/device management:** not implemented as complete user controls. Security wording should not imply otherwise.
- **Creator battles:** supported behavior is invitation/status management; it is not a full real-time battle engine and does not calculate scores, declare winners, or settle prizes automatically.
- **Missions and rewards:** an administrator must define an achievable goal and an actually fulfillable reward. Claims require manual review. The application does not automatically transfer money, coins, or diamonds.
- **Hall of Fame and rankings:** ranking views are based on currently available, permitted database metrics. They are not historical award ledgers and do not invent missing entries.
- **Achievements:** are derived from available live metrics; they are not proof of official platform certification or external TikTok recognition.
- **Verification:** submissions require human moderation. A submitted application is not verification. Avoid collecting identity documents via public URLs.
- **Legal pages:** platform terms, privacy policy and guidelines are drafts and need legal review against the actual product and applicable laws before public release.
- **Visual QA:** source and responsive CSS can be checked, but this environment does not confirm rendering on every physical phone/browser, screen reader, or network condition.
- **Cache/service worker:** release version is bumped to avoid stale frontend modules, but deployed CDN/browser caches should still be inspected if a user reports outdated code.
- **Back-end installation dependencies:** Node 20 or newer is required. Use the backend lock/dependency strategy already used by the live host and run tests after install.

- **Automated PayPal payouts are not implemented in this update.** Existing payout processing records administrator-confirmed external transfers. A separate PayPal Payouts API integration needs permissions and end-to-end testing.
- **Advanced video editing/effects, AI recommendations and audio-only LIVE are selected follow-on work**, not claims of this schema/UI repair release.
- **Production acceptance is outstanding.** No live migration, Render environment inspection, PayPal transaction or physical-device UI test was run during package preparation.
