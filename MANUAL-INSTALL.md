# Creator Hub Live — coordinated manual update

This is a **changed-files-only** bundle. Keep the paths shown in the ZIP and merge/overwrite only these exact files in the existing `ravaunrichards/creator-hub-live` repository. Do not replace whole folders or delete files that are not in this bundle.

## Apply in this order

1. Back up the current repository and database before installation.
2. Apply `database/migrations/0036_social_messaging_creator_tasks.sql` through the project's existing Supabase migration workflow. It adds message edit metadata and server-owned creator task cycles, synchronizes profile privacy, and tightens post visibility policies.
3. Apply `database/migrations/0037_gift_catalogue_diamond_payout_values.sql`. It validates the existing gift columns and makes active-gift diamond payouts reproducible using the existing 2-coins-to-1-diamond rule, with a minimum of one diamond. It does **not** change coin prices, wallet balances, or transactions.
4. Upload the remaining repository-relative files from this ZIP to GitHub, preserving each path. The frontend and Android WebView copies are both included.
5. Allow your normal GitHub/Render/static-site deployment process to run. This package has not deployed or edited GitHub, Supabase, Render, or the live website on your behalf.

## Included changes

- For You and Following feeds: real active-LIVE discovery, refresh of active listings, profile-privacy checks, post feed pagination, and scrolling.
- Profile pages: cover/avatar URL customization, real identity names, profile posts loaded newest-to-oldest, follow/unfollow, private follow requests, follower/following/friends lists, block/unblock and reporting.
- Post engagement: likes, comments with server-side visibility checks, repost, share, named save collections and a Saved page.
- Messages: edit text messages for 15 minutes and remove sent messages for everyone, with server-side ownership checks.
- Creator achievements/tasks: progress based on actual LIVE session duration, published posts and accepted followers; a new task is assigned after completion.
- LIVE guest stage: adjustable 0–8 guest slots, adaptive responsive participant tiles, host requests for guest microphone/camera with guest accept/decline, real participant names, reliable room data events, and return-to-viewer behavior when a guest is removed.
- Gift payout migration and LiveKit data transport for room reactions, polls, gifts and media requests.
- Privacy-aware post access, service-worker cache refresh, and synchronized Android web assets.

## Verification performed

The local project checks passed before packaging:

- `npm run check` — **360 passed, 0 failed**, including the social/profile/task contract checks.
- `npm run backend:test` — backend syntax and existing LIVE authorization/track-contract checks passed.
- `npm run repair:contracts` — passed, including frontend/Android web-asset parity.

These are code/contract tests, not a production end-to-end test. The migrations have **not** been applied to the live database here; real Supabase, Render, PayPal, and multi-device LiveKit behavior must be verified after installation.

## Deliberate scope limits

This update does not add fake filter controls. Real face filters/green-screen background replacement still require a verified outbound-video processing/segmentation pipeline, and this feed provides active LIVE discovery cards plus scrolling posts rather than multi-room autoplay video. Profile avatar/cover customization currently accepts valid HTTPS image URLs; direct in-app image upload is not included.
