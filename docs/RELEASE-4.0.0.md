# Creator Hub Creator Network — Website Release 4.0.0

## Release intent

This is the coordinated full website/backend/database source package for the **existing** `ravaunrichards/creator-hub-live` project. It is intended for manual installation. It is not a new project, mock website, isolated CSS patch, or remote deployment.

## Included

- Complete static website under `frontend/` including navigation, authentication, creator profiles, feeds, search/discovery, posts, messages, notifications, LIVE/LiveKit client, teams, team leagues, standings, creator leagues, wallet, PayPal checkout, creator payout views, admin controls, creator statistics, account settings, privacy/accessibility, and community features.
- Existing backend API source and its tests under `backend/`.
- Existing ordered database migration history plus the new forward-only migration `0024_creator_community_account_controls.sql`.
- Read-only database diagnostics, installer/operations docs, and website/source/contract tests.
- Browser-safe config plus a separate deployment configuration example.

## Deliberately excluded from this website release package

The standalone Android project/APKs and the unrelated Academy/course-learning, games, mapping/navigation, dictionary/translation/currency-tool browser modules are excluded from the package and the website navigation. Migration `0021_social_academy_conversations.sql` remains because it also creates the direct-message and notification infrastructure required by this website; it is not a reason to re-add the excluded learning UI.

## Behavior rules

- No seeded fake creator activity, gift events, standings, battles, missions, verified badges, rewards, or payment records.
- Gift rankings use recorded `gift_transactions` within a rolling day/week/month window.
- Achievements are calculated from actual creator metrics; verification badges require administrator approval.
- A creator battle begins as an invitation and keeps its real persisted status; this release does not fabricate match scores or winner/prize settlement.
- Mission/reward definitions must be configured by an administrator. Claims are reviewed manually; accepting a claim does not transfer cash, coins, or diamonds.
- PayPal remains the checkout provider. Existing purchase/order/capture/credit logic is retained and checked by source/contract tests; do not paste OAuth access tokens into browser configuration.

## Install summary

Read `INSTALL.md` and `DATABASE.md` first. Back up website/backend configuration and Supabase data. Verify schema with the read-only diagnostics. Review the existing installed migration history and apply only the missing, dependency-compatible migrations. Deploy backend before frontend routes that depend on new API/database behavior. Follow `VALIDATION-4.0.0.md` and `PRODUCTION-ACCEPTANCE-CHECKLIST.md` after manual installation.

## Validation boundary

Repository tests validate source syntax, route and asset contracts, security patterns, and selected mocked/in-process backend flows. They do **not** prove that this deployment's Supabase schema already matches, PayPal credentials are authenticated, LiveKit credentials/network are correct, the hosting provider serves the intended release, or layouts work on every physical device. Those checks require manual production-environment validation. This package has not been deployed remotely by the preparer.

The migration also hardens the existing follower/like/comment counter triggers so profile column-level update restrictions do not break ordinary social interactions. Verify counter increments and decrements with real test accounts after applying it.

Migration 0024 also restricts browser-readable profile columns so the internal `is_admin` flag is obtained through the current-user `is_admin()` function rather than a public profile-row read. The migration and explicit grants should be reviewed with the target project schema before installation.

## Latest build verification

The exact source tree packaged for this release passed 237 website/source integrity assertions, the private-credential pattern scan, migration static structure validation, and the backend contract/regression suite. The optional TikTok username config lookup now safely defaults to an empty string rather than aborting the config script when no social-link object is configured. The backend rejects protected requests when the account profile is deleted or inactive, and profile visibility now consults account privacy and mutual blocks. See `LOCAL-TEST-RESULTS-4.0.0.txt`; browser rendering and live provider acceptance remain unverified in this environment.
