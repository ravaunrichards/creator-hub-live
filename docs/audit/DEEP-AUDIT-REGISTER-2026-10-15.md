# Creator Hub Live — Deep Audit & Master Error Register

**Audit window:** 14–15 October 2026 (UTC)  
**Repository:** `ravaunrichards/creator-hub-live`, branch `main`  
**Repository revision inspected:** `3f5d0f1ce76d2120e538939ee56ff94ca43046e2`  
**Connected Supabase project:** `Creator-Hub-Live` (`txibryhznycmuqufnxvh`)  
**Hosting:** Existing Render frontend and backend services  
**Mode:** READ-ONLY AUDIT. No fixes, GitHub writes, migrations, database writes, deployments, credential rotations, or APK rebuilds were performed by this audit.

## How to read this register

- **Confirmed — production evidence:** seen in current production logs or live database.
- **Confirmed — source/schema:** proven in the current repository or live schema, but not necessarily reproduced in a full browser/device test.
- **Reported — reproduce:** reported in earlier sessions; current runtime reproduction still required.
- **Feature gap / requirement:** not currently supported, or not supported to the level requested.
- **Review warning:** a tool flags a concern that needs contextual review; do not automatically treat it as a vulnerability or drop/change anything without confirming usage.

The report deliberately distinguishes current evidence from remembered symptoms and untested requirements. A passing source test is not the same as a working production flow.

# Executive summary — highest-priority findings

1. **CRITICAL — private-looking backend secrets are committed in a public `.env.example`.** The file contains non-placeholder values for a Supabase service-role credential and streaming/payment-provider credentials. Their validity was not verified; treat them as exposed until safely rotated. The current security scan misses them because it expects quoted assignments, while the example values are unquoted.
2. **CRITICAL — LIVE guest requests fail in production.** The backend writes status `requested`; the live database’s `live_guests_status_check` does not allow `requested`. Render logs show the resulting PostgreSQL check-constraint errors.
3. **HIGH — expired/missing Supabase sessions are repeatedly returning HTTP 401.** Logs show `AuthSessionMissingError` / `Auth session missing!` and `Invalid or expired Supabase session.` The exact failing client request and token lifecycle still need correlation.
4. **HIGH — guest-stage workflow has more than one gap.** The host’s guest list has no real-time/periodic refresh; accepting a guest only changes the database row and does not update the already-connected guest’s LiveKit publishing permission. The stage source also appends remote tracks to one common container without a participant-specific named tile.
5. **HIGH — the latest successful Android CI build still contains old media.** Current website JavaScript/CSS copies match Android, and all 90 gift sound files match, but 90/90 artwork files and 90/90 animation files differ. Four multi-guest layout SVGs are missing from Android. The workflow does not synchronize assets or run the full test suite before assembling the APK.
6. **HIGH — current migration names/history are not aligned.** The repository has `0025_live_guest_request_workflow.sql`; the live migration ledger does not list it and has reused numeric prefixes for different migrations. A forward-only, preflighted migration is required later; blindly replaying numbered SQL is unsafe.
7. **HIGH — visible UI and design requirements remain unmet.** The Analytics page contains a prohibited outside-platform reference; guest UI uses a generic fallback and appends status text after the account name; compact phone LIVE CSS makes controls and gift text very small. The requested future provider buttons, wallet custom amount, automatic LIVE-minute milestone progression, and comprehensive edit/delete inventory are not complete.
8. Supabase security/performance advisors report meaningful follow-up work: missing RLS policies on 16 tables, publicly callable `SECURITY DEFINER` helpers, leaked-password protection disabled, 53 unindexed foreign keys, 57 RLS auth-initplan findings, seven unused indexes, three duplicate-index groups, three overlapping permissive-policy findings, and `citext` in `public`. Some findings may be intentional or premature at current low row counts; investigate before changing them.
9. Live database contains **40 `pending` LIVE sessions**, 24 older than 24 hours and 10 older than 72 hours, alongside five `live` and 42 `ended` sessions. This is a cleanup/lifecycle concern; do not bulk-delete without confirming intended scheduled/pending semantics.
10. The connected database currently has **zero league seasons** and **zero creator missions**. Automatic LIVE-minute milestone progression cannot work as requested until both the product logic and the necessary live configuration/data are in place.

# P0 — urgent security and account-access failures

## P0-01 — Public repository contains credential-shaped private backend values

**Status:** Confirmed — source; validity of individual values not verified.  
**Location:** `backend/.env.example` in public `main`.  
**Evidence:** The tracked example contains non-placeholder values in fields for the Supabase service-role key, LiveKit credentials, and PayPal credentials, with the PayPal environment set to live. Values have been intentionally omitted from this report.

**Impact:** If any are still active, a public reader may be able to exercise elevated database, streaming, or payment-provider access. Supabase service-role credentials bypass ordinary row-level security and must remain server-side. A public example file must use obvious placeholders, never live secrets.

**Additional issue:** `tests/security-audit.js` checks for quoted credential assignments such as `SUPABASE_SERVICE_ROLE_KEY='...'`; the values in the tracked example are unquoted. That means the test can report a clean scan while missing the actual pattern. The existing “no credential patterns” QA statement is therefore a false negative for this file.

**Required repair after authorization:** First review actual service dependencies and coordinate credential rotation with provider consoles; replace public values with placeholders, update Render’s private environment, verify each service, and then disable/revoke exposed credentials after cutover. Decide whether to clean repository history in addition to removing them from the current tree. Do not paste secrets in issues, reports, screenshots, or the frontend. No rotation was performed in this audit.

Research: [Supabase API keys and secret-key handling](https://supabase.com/docs/guides/getting-started/api-keys), [Supabase key rotation](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd).

## P0-02 — LIVE guest request is rejected by a database constraint

**Status:** Confirmed — production logs + live schema + backend source.  
**User-reported error:** `New row for relation "live_guests" violates check constraint "live_guets_sttus_check"`  
**Current production constraint name:** `live_guests_status_check` (the spelling differs from the reported error; the current database does have the same status mismatch).  
**Backend:** `backend/src/server.js`, guest request handler.  
**Database:** `public.live_guests`.

The backend inserts or updates `live_guests.status = 'requested'`. The connected database currently allows `invited`, `accepted`, `rejected`, `removed`, and `left` only. `requested` is not allowed. Production logs show SQLSTATE `23514` constraint errors when request rows are written.

**User impact:** “Request to join stage” fails, the host sees no request, and the guest cannot be accepted into the stage.

**Migration evidence:** The repo has `database/migrations/0025_live_guest_request_workflow.sql`, which adds `requested` to the check constraint. The live migration ledger does not show that migration name as applied. The ledger has other migrations reusing the 0025–0029 number range, so migration naming must be reconciled before an authorized migration.

**Required verification after fix:** Viewer request writes successfully; host receives it; host accepts/rejects; a second guest can request; duplicate requests behave predictably; cancelled/removed/left state works; no constraint error appears in logs.

## P1-03 — Invalid/expired Supabase sessions are actively returning 401

**Status:** Confirmed — production logs; exact originating UI request not yet isolated.  
**Messages seen:** `AuthSessionMissingError`, `Auth session missing!`, and `Invalid or expired Supabase session.` with HTTP 401 / `AUTH_REQUIRED`.

**Source observations:** `frontend/src/core.js` configures session persistence, automatic refresh, and URL session detection. `CHL.getSession()` calls `sb.auth.getSession()` but does not propagate its returned error. `CHL.authenticatedApiRequest()` obtains the current access token and submits the request, but there is no single controlled refresh-and-retry path for an expired-token 401. The backend validates a bearer token with Supabase Auth and rejects missing/expired tokens.

**Likely contributing causes to distinguish:** expired access token with refresh not completed, missing/cleared refresh token, Auth callback racing page initialization, Android WebView/browser storage behavior, redirect confirmation/recovery session not restored, stale tab, or frontend retry loops. The audit does not claim which is the final root cause.

**Required verification:** capture request path + correlation ID safely; test sign-in, refresh near expiry, tab sleep/wake, multiple tabs, WebView restart, email-confirmation return, password-reset return, revoked session, and invalid refresh token. Refresh once and retry once only; if refresh fails, clear local invalid state and request a fresh login without relaxing API authorization.

Research: [Supabase `getSession`](https://supabase.com/docs/reference/javascript/auth-getsession), [Supabase `refreshSession`](https://supabase.com/docs/reference/javascript/auth-refreshsession), [Supabase session lifecycle](https://supabase.com/docs/guides/auth/sessions).

# P1 — LIVE, guest stage, and route/data synchronization

## P1-04 — Guest approvals do not automatically update the host’s guest list

**Status:** Confirmed — source-level gap.  
**Location:** `frontend/src/pages-room.js`, `loadGuests()` and guest stage controls.

`loadGuests()` runs at initial room entry, on manual refresh, or after the current user’s own guest action. The code has no realtime subscription or periodic guest-list refresh. The LIVE tools’ 6-second polling refreshes other room tools; it does not refresh the guest list. A request from a different viewer can therefore remain invisible to the host until manual refresh or another action triggers a reload.

**User impact:** The viewer sees a failed/no-response experience even when the guest row has successfully been written.

**Required verification after fix:** two separate accounts open the same room; request appears on host without manual refresh; accept/reject state updates on both; disconnect/reconnect resumes correct state.

## P1-05 — Accepting a guest updates the database but not the connected LiveKit participant permissions

**Status:** Confirmed — source-level gap; full two-device runtime not tested.  
**Location:** `backend/src/server.js`, guest `accept` route; `frontend/src/pages-room.js`, join/connection setup; `backend/src/livekit-token.js`.

The accept route updates `live_guests.status` to `accepted`. But the connected room’s `canPublishMedia` is derived once at join, and the browser connects with a token created at that time. No server-side `RoomServiceClient.updateParticipant()` call (or equivalent token/permission refresh) was found on guest approval. The guest is likely to require a reconnect/rejoin to gain microphone/camera publishing, rather than moving smoothly from viewer to stage.

**Required verification after fix:** host acceptance makes the actual currently connected viewer publish-capable; host rejection never grants publishing; removing a guest revokes publishing and unpublishes tracks; host and guest UI states stay consistent.

Research: [LiveKit participant permissions and UpdateParticipant](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/). LiveKit documents server-side permission updates and a `ParticipantPermissionChanged` event.

## P1-06 — Multi-guest stage has no participant-specific named video tiles

**Status:** Confirmed — source-level gap; visual/runtime confirmation required.  
**Locations:** `frontend/src/pages-room.js`, `frontend/src/livekit.js`, `frontend/assets/gifts/multi-guest/`.

Remote-track handling in the page receives the track but discards the participant object and calls `CHL.attachRemoteTrack(track, stage)`. The helper attaches each track directly to the same stage container; it does not create a per-participant tile or bind each video to the account name. The source contains four layout SVG assets (`grid-2.svg`, `grid-3.svg`, `grid-4.svg`, `seat-empty.svg`), but the current frontend code does not reference those paths or implement the corresponding layout selection. The current guest list is a side panel rather than the requested multi-person stage.

**Required behavior:** switchable layouts use the real number of connected participants, show each account’s actual name only, place video in the correct tile, respect host/moderator guest caps and accepted status, and remove a tile when a guest leaves. No fixed fake tiles or invented participants.

## P1-07 — LiveKit participant labels are role labels or account IDs, not account names

**Status:** Confirmed — source mismatch.  
**Locations:** `backend/src/livekit-token.js`, `frontend/src/livekit.js`, `frontend/src/pages-room.js`.

The LiveKit token `name` is set to `Host` or `Viewer` based on `canPublish`; an accepted guest can therefore receive `Host` as the display name. Participant-connected/disconnected toasts say `Participant joined/left: <identity>` and the identity is the account UUID. Guest-list display uses `display_name || username || 'Creator'` and appends ` · status` after the name.

**Owner’s rule:** show only the name attached to the account — no generic `Participant`/`Creator`, UUID, role label, or status appended to that name field. Keep action buttons separate. If the account has neither name field populated, do not invent one; resolve the missing-profile state explicitly.

## P1-08 — Explore/Home stream cards do not refresh when another person ends a LIVE

**Status:** User-reported symptom; source gap confirmed; a stale card was not reproduced in this audit.  
**Locations:** `frontend/src/pages.js`, `backend/src/server.js`.

The backend end route sets `status = 'ended'`, `ended_at`, and `updated_at`. `/api/live/rooms`, Home, and Explore select `status = 'live'`; the query filter itself is correct. However, `loadLive()` reads a snapshot and does not subscribe to database changes or periodically refresh while the user remains on the page. If someone else ends their stream, an already-rendered card may remain until the page re-renders/reloads.

Live database snapshot: 87 rows — 42 `ended` (all have `ended_at`), 5 `live` (all have `ended_at` null; all started within the last 24 hours), and 40 `pending`. Therefore the audit did **not** find ended rows incorrectly marked live at query time.

**Required verification:** another account ends a LIVE while Home/Explore is open; card disappears promptly; an ended deep link cannot rejoin; no stale active card remains after reconnect/reload. Add realtime invalidation or carefully managed polling. Define an expiry policy for abandoned pending rows: 24 are older than 24 hours and 10 are older than 72 hours, but do not blindly end any session without checking lifecycle rules.

## P1-09 — Android app bundles older gift art/animations and lacks multi-guest layout SVGs

**Status:** Confirmed — GitHub asset SHA comparison and CI workflow/source inspection; the APK binary itself was not extracted for direct hash comparison.  
**Source:** `frontend/assets/gifts/`  
**Android destination:** `android/app/src/main/assets/web/assets/gifts/`.

| Asset family | Website source | Android bundle | Finding |
|---|---:|---:|---|
| Gift artwork SVGs | 90 | 90 | **All 90 hashes differ**; Android files are much smaller simplified versions |
| Gift animation SVGs | 90 | 90 | **All 90 hashes differ**; Android files are much smaller simplified versions |
| Gift sound WAVs | 90 | 90 | **All 90 hashes match** |
| Gifter badges | 6 | 6 | Current copies match based on filename/hash checks inspected |
| Multi-guest layout SVGs | 4 under `multi-guest/` | 0 under that folder | `grid-2`, `grid-3`, `grid-4`, `seat-empty` missing from Android |
| Root `multi-guest.svg` | 1 | 1 | Present in both |

The JavaScript and CSS file hashes inspected for `frontend/src` and `frontend/styles` match Android. This is a media-sync issue, not a wholesale JS parity issue. Because the workflow builds the existing Android bundle without first syncing assets, the resulting APK is expected to embed the older media; this is inferred from the build inputs, not claimed as a direct APK-binary inspection.

The gift manifest contains 277 paths (90 art + 90 animation + 90 sounds + 6 badges + the root multi-guest graphic); it does **not** list the four `multi-guest/` layout SVGs. They are also not referenced by current LIVE-stage JavaScript, so the layout feature is incomplete as well as the Android copy.

## P1-10 — Android CI builds a debug APK without synchronizing assets or running project checks

**Status:** Confirmed — current workflow and latest successful CI run.  
**Workflow:** `.github/workflows/creator-hub-android.yml`.

The workflow runs `gradle assembleDebug` and uploads `creator-hub-android-debug`. It does not run `npm run studio:sync-android` first and does not run the root `npm run check` test suite. Consequently, a successful build can package old media and can pass without any backend/auth/gift/live contract tests.

**Latest CI run:** GitHub Actions run `38629260442` for commit `3f5d0f1ce76d2120e538939ee56ff94ca43046e2`; build completed successfully and uploaded artifact ID `11925826542` (`creator-hub-android-debug`). The repository’s Android source bundle contains the older art/animation versions described in P1-09, and the workflow does not sync them before building. The artifact binary was not extracted to compare hashes directly; this confirms the pipeline does not guarantee asset parity, rather than proving the APK binary contents independently.

## P1-11 — APK release provenance and device acceptance are unverified

**Status:** Confirmed ambiguity.  

- `main` contains `releases/creator-hub-live.apk` (25,729,472 bytes), added in the latest commit; the previous `creator-hub-live-release.apk` and `creator-hub-live-release-alt.apk` names were removed in the preceding commits.
- A successful GitHub Actions **debug** APK artifact exists as described in P1-10.
- The current release manifest still states that a Nexus 6.0.2 release APK was not rebuilt/signed in the original packaging environment. This statement may be stale or may refer to a signed production release rather than the CI debug artifact.
- The committed root APK could not be downloaded for binary provenance inspection in this environment; no claim is made that it equals the CI artifact or is a correctly signed release APK.
- Neither Android nor iPhone hardware/camera/microphone/permissions/payment flows were installation-tested by this audit. The iPhone entry is a web page, not an IPA.

The user must not be told an APK is “fixed” merely because `assembleDebug` succeeded. Verify the exact APK’s commit, version, signing certificate, asset hashes and installation/feature flows after the authorized repair.

# P2 — Data/security warnings requiring controlled review

## P2-12 — Supabase migration ledger does not match the repository’s migration naming

**Status:** Confirmed — live ledger vs current source.  

Live ledger records migrations from `0015_teams_backend_complete`, `0016_official_division_tiers`, `0018_teams_schema_convergence`, `0019_league_operations_and_payouts`, `0020_wallet_gift_schema_and_security`, `0021_social_academy_conversations`, `0022_creator_media_storage`, `0023_settings_schedules_analytics`, `0024_creator_community_account_controls`, `0025_appearance_preferences`, `0026_security_definer_execute_hardening`, `0027_gifter_levels_catalog_and_live_tools`, `0028_secure_gift_send_rpc`, `0029_complete_90_gift_catalog`, `0030_disable_legacy_non_catalog_gifts`, `0031_catalog_and_self_progress_read_policies`, `0032_harden_trigger_function_execution`, `0033_team_access_policies`, and `0027_live_room_experience`.

Repository `database/migrations/0025_live_guest_request_workflow.sql` and `0026_nexus_live_room_experience.sql` are separately named and not represented by the same migration names in that ledger. Multiple migrations reused numeric prefixes historically. The source tree must be reconciled with actual database definitions and ledger before any migration. Do not replay historical migrations blindly; the exact active schema has to remain the source of truth.

## P2-13 — Supabase security advisor: RLS policy inventory needs owner/role review

**Status:** Confirmed — advisor findings. Not all findings are vulnerabilities.  

- 62/62 public base tables have RLS enabled; none has RLS disabled. None has `FORCE ROW LEVEL SECURITY`; that by itself is not sufficient evidence of a user-facing vulnerability.
- 16 tables have RLS enabled but no policies: `audit_log`, `gift_transaction_reversals`, `live_interaction_events`, `live_interaction_totals`, `live_room_moderators`, `live_room_poll_votes`, `live_room_polls`, `live_room_questions`, `live_room_reactions`, `live_room_recordings`, `live_viewer_presence`, `match_participants`, `matches`, `referrals`, `sounds`, and `taps`. Many LIVE/ledger tables may be intentionally service-role-only; verify grants and call paths before adding policies.
- The advisor flags six public-schema `SECURITY DEFINER` functions executable by `anon`, including access/profile-check helper functions and public ranking functions. It flags 13 executable by `authenticated`. These may have legitimate API contracts; inspect each function body, `search_path`, argument trust, `auth.uid()` checks, and intended grants before revoking any.
- The database grants report shows broad table privileges exist for many client roles, with RLS expected to limit visible rows. Least-privilege grants should be reviewed with RLS policies together; do not simply make service-owned tables public or assume a table is exposed because a grant exists when RLS has no policy.
- `citext` is installed in the `public` schema; the advisor recommends considering an extension schema.

Research: [Supabase Row Level Security guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase API key guide](https://supabase.com/docs/guides/getting-started/api-keys).

## P2-14 — Supabase performance advisor: indexes and RLS predicate efficiency

**Status:** Confirmed — advisor findings, requiring query-plan/workload review.  

- **53 foreign keys** lack a covering index, including examples in `live_guests`, `gift_transactions`, `live_chat_messages`, `league_events`, and other high-traffic feature tables.
- **Seven unused indexes:** `posts_hashtags_idx`, `posts_search_idx`, `team_members_joined_idx`, `teams_points_division_idx`, `league_matches_season_round_idx`, `diamond_withdrawals_admin_queue_idx`, and `live_room_recordings_retention_idx`.
- **Three duplicate index groups:** the `gift_transactions` idempotency key indexes; `paypal_payout_info` primary key and user-id unique index; `wallets` primary key and user-id unique index.
- **Three overlapping permissive policy groups:** `creator_verification_requests` UPDATE; `likes` SELECT; and `reposts` SELECT.
- Many policies call `auth.uid()` or current-setting expressions in ways that may re-evaluate per row; Supabase recommends scalar-subquery form such as `(select auth.uid())` where semantics allow.

Production currently has only four profiles, four wallets, and zero gift transaction rows, so unused-index results may reflect low activity rather than useless indexes. Do not drop any index until queries and representative workload are reviewed. Prioritize LIVE/gift/wallet/message/team paths and test query plans.

## P2-15 — Frontend SDK pins need a controlled compatibility review

**Status:** Confirmed — version comparison; not proven to cause a current failure.  

`frontend/index.html` and `frontend/index.iphone.html` pin Supabase JS to `@supabase/supabase-js@2.45.4` and LiveKit client to `2.22.3`. Current npm pages show Supabase JS 2.117.1 and LiveKit client 2.22.4 as newer published versions. The Supabase pin is materially older; LiveKit is one patch behind. Upgrade only in a branch with complete auth/session, realtime, WebView, and media regression testing. Both scripts currently load from jsDelivr without Subresource Integrity (SRI) attributes.

Sources: [Supabase JS on npm](https://www.npmjs.com/package/@supabase/supabase-js), [LiveKit client on npm](https://www.npmjs.com/package/livekit-client).

# P2 — UI and feature requirements

## P2-16 — Analytics page has a visible prohibited outside-platform reference

**Status:** Confirmed — source.  
**Location:** `frontend/src/pages-creator.js`, Analytics copy around line 56, says “third-party TikTok analytics”. `frontend/config.js` also carries a non-visible `TIKTOK_USERNAME` property. The visible Analytics copy must be removed. After authorization, run a case-insensitive repository-wide search across web/mobile markup, CSS/JS, manifests, metadata and visible copy. Distinguish user-visible UI strings from internal docs/history, but do not let the app display the prohibited name.

## P2-17 — Login screen and registration are much simpler than requested

**Status:** Confirmed — source feature gap.  

Current login is email/password. Registration asks username, email and password only; the login screen has no visible “Forgot password?” link. Separate `/forgot-password`, `/reset-password`, `/verify` and `/oauth` routes exist in another module, but email sending, redirect URLs, confirmed-email state, password update return, Android WebView and actual session restoration have not been validated end-to-end.

**Required later:** a professional, modern, high-contrast account entry experience; full name/display name, unique username, DOB with privacy/age validation, email confirmation, forgot/reset password, password visibility, strength/validation, loading/failure/success states, and easy sign-in/register switching. Email is the current method. Phone authentication and Apple, Discord, Facebook, Twitch, Zoom, and Twitter are explicitly **future providers only**; do not render them as active or connected until configured and actually tested with Supabase.

## P2-18 — Wallet does not support custom coin amounts yet

**Status:** Confirmed — source feature gap.  

The Wallet presents server-defined packages and a PayPal checkout path. The backend validates the selected coin count against the server package catalogue; an arbitrary custom number is not supported. The live DB has six active USD packages ($0.99–$99.99). Add custom amounts only with server-authoritative price rules, min/max/rounding policy, idempotency, integrity checks and actual PayPal sandbox/live verification. Never take the displayed price or wallet credit directly from the client.

## P2-19 — Automatic LIVE-minute milestone progression is not implemented

**Status:** Confirmed — schema/source feature gap.  

Current mission metric constraints support followers, posts, views, streams, gifts received, diamonds from gifts and coins spent gifting, but not LIVE minutes. Existing achievements include first LIVE and 10-LIVE counts; mission claims need manual review. The requested automatic 30-minute LIVE target followed by an automatically issued next target is not present. Later design must measure durations on the server from trustworthy start/end events, deduplicate reconnect/retry events, and progress milestones automatically without client-manufactured time or rewards.

## P2-20 — Edit/delete tools are incomplete by feature and role

**Status:** User-reported; full control inventory not complete.  

Some tools do exist (Edit profile, Edit team, member removal, recording delete, question delete, blocked accounts, and account deactivation/permanent deletion). The report therefore does **not** treat “no delete buttons anywhere” as confirmed. Later audit must list each page/entity and role, verify what can be edited/deleted, add discoverable controls where allowed, check ownership/admin authorization, confirmation dialogs, retention/cascade behavior, and persistence after reload.

## P2-21 — Small type, low readability, and overly compact phone LIVE layout

**Status:** User-reported; CSS explains likely contributing styles, physical visual test outstanding.  

The default style is a dark theme with a light-theme option. The compact phone LIVE CSS at widths up to 860 px uses a two-column layout with video and chat/gifts sharing the limited screen; gift labels are shrunk to roughly 10 px and price labels to roughly 9 px. This directly conflicts with the request for readable, bold gift names and a larger live display. The UI needs focused redesign, not a blanket CSS override. Inspect white/light surfaces, muted text, selected/disabled buttons, gift names/prices, stage/camera area, chat input, settings/forms, and every viewport. Automated mocked smoke tests do not guarantee acceptable contrast/readability on the physical device.

## P2-22 — UI strings show generic creator/participant labels instead of account names

**Status:** Confirmed — source mismatch.  

The LIVE participant callbacks show “Participant joined/left” plus an ID. Guest cards use a fallback “Creator” and append status text after the name. The user’s rule is to show only that account’s actual name in the name field; remove generic labels/IDs/status appended to the account name and keep buttons separate.

## P2-23 — Other reported issues require controlled runtime reproduction

**Status:** Reported — no complete current-run reproduction during this audit.  

- Go LIVE previously surfaced a `code` getter/type error.
- Microphone/camera “not connected” and `Network disconnected` messages.
- `NOT_FOUND` / route-not-found errors and inaccessible pages.
- Search for account names/similar usernames did not reliably find profiles.
- Old phone LIVE UI included six small boxes, a heart and `JMD0`, plus an unwanted “run prefix” button/label.
- Gift controls previously appeared as image-only rather than interactive buttons.
- User reports of missing edit/delete controls and missing newly added gifts.

These require route-by-route testing, real API/log correlation and device interaction. The presence of code for a feature is not evidence it works.

# Build/deployment verification facts

- Render frontend and backend services are healthy/active. The frontend is a static site; the backend is a Node service. The most recent successful Render deployments observed were around 14 October 2026 at revision `26539e6bc1899d4d4caa0e3594b15edaa9a6500d`.
- GitHub `main` is now revision `3f5d0f1ce76d2120e538939ee56ff94ca43046e2`. The two commits after the Render revision changed root-level release APK files, outside the Render services’ `frontend/` and `backend/` roots. This means the hosted application source directories appear to match current `main` for those paths, but the runtime defects remain.
- Latest GitHub Actions Android build **succeeded** for current `main` and produced a debug artifact. The workflow did not run `npm run check` and did not run `npm run studio:sync-android` first.
- The latest QA markdown’s “256 checks passed” describes a separate prior local source check; it is not evidence that the latest commit’s entire test suite passed in CI. Its security-scan “no credential patterns” claim is contradicted by the tracked `.env.example` issue above.
- Existing QA documentation explicitly says mocked browser tests did not hit real Supabase accounts, LiveKit two-user streaming, payment settlement or physical device behavior.

# Ordered repair sequence — DO NOT START UNTIL APPROVED

1. **Security containment plan:** rotate exposed provider credentials safely, remove real values from the tracked example, repair the secret scanner, and review Git history. Because this may affect live service connectivity, coordinate the rotation and Render environment updates.
2. **Guest-request blocker:** prepare a forward-only migration from the actual live schema; verify request status, list refresh, host accept/reject, publishing permission transitions and stage display using two real test accounts.
3. **Session recovery:** add controlled refresh-and-retry, proper error handling and correlation IDs; test browser + Android WebView expiry/confirmation/reset flows.
4. **LIVE/Explore lifecycle:** ensure ended streams disappear promptly across open Explore pages and deep links; define pending-room cleanup; test LiveKit reconnect and camera/microphone publishing.
5. **Multi-guest stage/names:** implement actual named video tiles/layout selection and safe server-side permission update/revocation; preserve the “only account name” rule.
6. **Android media/CI parity:** run asset sync before APK build, verify web/Android file hashes, include all multi-guest SVGs, run the full test suite in CI, then verify APK version, certificate and device installation.
7. **Gifts and Wallet:** reconcile all active database gift names/prices with correct existing media, preserve new gifts; design and test server-authoritative custom coin amounts.
8. **Milestones and account UX:** implement server-timed LIVE-minute progression; improve login/register/reset/confirmation flows. Keep social providers deferred until separately configured.
9. **UI quality:** remove the prohibited visible platform reference; redesign readable bold type, contrast, and the phone LIVE layout; do page-by-page edit/delete inventory.
10. **Security/performance hardening:** review all flagged RLS/SECURITY DEFINER grants, duplicate/unindexed indexes and policy overlap against actual query paths. Do not apply broad grants or index drops automatically.
11. **Acceptance:** execute the full CI suite, two-account LIVE tests, email confirmation/reset, custom and preset checkout in approved test mode, and physical Android/browser checks. Record evidence and reopen any failed item.

# Online research used

- Supabase documents `getSession()` returning a session after refresh when possible, `refreshSession()` behavior on invalid refresh tokens, and the single-use refresh-token lifecycle: [getSession](https://supabase.com/docs/reference/javascript/auth-getsession), [refreshSession](https://supabase.com/docs/reference/javascript/auth-refreshsession), [sessions guide](https://supabase.com/docs/guides/auth/sessions).
- Supabase identifies publishable keys as appropriate for browser/mobile code and secret/service-role keys as backend-only because they bypass RLS; it documents rotation of exposed keys: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [rotating exposed keys](https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd).
- LiveKit documents server-side participant permission changes and the `ParticipantPermissionChanged` notification, applicable when promoting a viewer to a speaker: [participant management](https://docs.livekit.io/intro/basics/rooms-participants-tracks/participants/).
- Package versions were checked against current npm listings: [@supabase/supabase-js](https://www.npmjs.com/package/@supabase/supabase-js), [livekit-client](https://www.npmjs.com/package/livekit-client).



# Additional deep-scan findings — live database and Supabase advisors

These results were added after the first report draft. They are read-only snapshots from the connected Supabase project; counts can change as the service operates.

## P0/P1 — private-key and database exposure review

### P0-24 — Supabase leaked-password protection is disabled

**Status:** Confirmed — Supabase security advisor. The Auth setting that checks new passwords against known compromised passwords is disabled. Enable it after reviewing the project's password policy and expected user experience. This is independent of the credential-shaped values found in the public repository.

Research: [Supabase password security and leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

### P1-25 — Six SECURITY DEFINER functions are callable by anonymous clients; thirteen are callable by authenticated clients

**Status:** Confirmed — Supabase security advisor plus direct catalog inspection. The warning includes functions for LIVE-session access, profile visibility, account-active status, public creator/gift rankings, and `is_admin()`, among others. The database has 50 SECURITY DEFINER functions; all 50 have an explicit `search_path` setting (28 use `public, pg_temp`, 21 use `public`, and one uses `pg_catalog`). Therefore, a missing search-path setting is **not** the current finding. Some public functions may be intentionally public, and SECURITY DEFINER can be required for a safe RPC design. The remaining concern is whether each function’s input validation, ownership checks, returned data, grants and intended audience are correct. Do not revoke grants wholesale without tracing every client call and test.

Research: [Supabase database linter — anonymous SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated SECURITY DEFINER functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### P1-26 — Sixteen RLS-enabled tables have no policies

**Status:** Confirmed — database advisor and schema query. Current public schema snapshot: 62 base tables; RLS enabled on all 62; RLS forced on zero; 16 RLS-enabled tables have no policies. The listed tables include audit logs, gift reversals, live interaction event/totals tables, live room moderators/polls/questions/reactions/recordings/viewer presence, matches/match participants, referrals, sounds, and taps.

“No policy” does not automatically mean publicly readable: the effective table grants and access path matter. The correct repair is to map intended access for each table, inspect grants and RPC paths, and add narrow owner/host/moderator/admin/public policies where appropriate. Do not disable RLS or create broad `USING (true)` policies to make features work.

Research: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [RLS enabled with no policies advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

### P1-27 — SECURITY DEFINER execution and role grants need function-by-function verification

**Status:** Confirmed — advisor warning. The advisor lists six anon-callable and thirteen authenticated-callable SECURITY DEFINER functions. Because some functions intentionally serve public rankings or secure transactional operations, verify each function’s behavior with adversarial inputs before changing grants. All 50 SECURITY DEFINER functions have an explicit `search_path` setting; still inspect whether sensitive functions accept caller-supplied user IDs or admin claims, validate ownership/role in the function body, constrain returned rows, and reject unauthorized state changes.

### P1-28 — Three duplicate-index groups add avoidable write/storage cost

**Status:** Confirmed — performance advisor. Duplicate groups are reported for gift-transaction idempotency, PayPal payout user IDs, and wallets. The wallet and payout groups involve primary-key/unique constraints, so the advisor result must be checked against constraint ownership before any index is dropped. For gift idempotency, retain the constraint that enforces uniqueness and any index actually needed by queries. No index was removed.

Research: [Supabase duplicate-index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index).

### P2-29 — Fifty-three foreign-key columns have no covering index

**Status:** Confirmed — performance advisor. The findings span social, messaging, wallet/payment, gift, LIVE, league and moderation tables. This can slow parent deletes/updates and joins as data grows. Prioritize high-write/high-read relations and indexes that support real query filters; validate query plans and avoid creating duplicate or low-value indexes.

Research: [Supabase unindexed foreign-key advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

### P2-30 — Fifty-seven RLS policies have per-row auth initialization patterns

**Status:** Confirmed — performance advisor. The advisor reports 57 cases where `auth.<function>()` or `current_setting()` is reevaluated per row. Where semantics allow, use the documented scalar-subquery pattern, e.g. `(select auth.uid())`, and compare query plans. This is a performance optimization, not permission to weaken a policy.

Research: [Supabase RLS performance guidance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).

### P2-31 — Three overlapping permissive-policy findings and seven unused indexes

**Status:** Confirmed — performance advisor. Overlaps are reported for `creator_verification_requests` UPDATE and `likes`/`reposts` SELECT. Seven indexes are flagged as unused, including post-search, team-member, league-match and recording-retention indexes. Low traffic or a fresh database can make valid indexes appear unused; do not delete them until query history and critical paths are reviewed.

Research: [Supabase multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

### P2-32 — `citext` extension is installed in the public schema

**Status:** Confirmed — advisor. `public.profiles.username` uses the `citext` type. Moving the extension may require dependency-aware migration planning because application types, functions and indexes may depend on it. Treat as a maintenance/security lint warning, not an emergency schema move.

Research: [Supabase extension-in-public advisor](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

## P1 — production data state and lifecycle

### P1-33 — Forty LIVE sessions remain `pending`, including 24 older than one day

**Status:** Confirmed — live database snapshot. Counts at the audit query time: 87 rows total; 42 `ended`, five `live`, and 40 `pending`. Of the pending rows, 24 had not been updated for more than 24 hours and ten for more than 72 hours. No row was found with status `live` and an end timestamp. This is consistent with a lifecycle/cleanup concern but does not by itself prove every pending row is stale; confirm whether pending means a draft, preflight, or scheduled room before writing cleanup logic.

**Required later checks:** define allowed state transitions, whether `pending` should ever appear in Explore, TTL for abandoned rooms, cleanup on host disconnect/crash, end-live idempotency, and behavior after a reconnect. Test that ending a live removes it from all discovery surfaces and direct joins, while preserving legitimate scheduled/pending flows.

### P1-34 — No guest rows exist in the live database snapshot

**Status:** Confirmed — live database snapshot. `public.live_guests` returned zero rows at the audit query time, despite the reported guest-request error. This is consistent with the failed constraint blocking insertion; it is not proof no one ever joined. After the constraint is repaired, verify insert, request listing, accept/reject, publish permission, slot allocation, leave/removal and host close all persist correctly.

### P1-35 — League schema exists but there are no league seasons

**Status:** Confirmed — live database snapshot. `public.league_seasons` exists, but it has zero rows and zero active seasons. League views that require an active season cannot return meaningful standings until an authorized seed/configuration operation creates one. Do not fabricate standings or insert an active season as part of an audit.

### P1-36 — Creator missions table is empty; automatic milestone progression has no live definitions

**Status:** Confirmed — live database snapshot. `public.creator_missions` contains zero rows; `creator_mission_claims` also contains zero rows. The requested sequence—go LIVE for 30 minutes, complete the target, automatically issue the next milestone—requires server-timed session duration accounting, mission definitions, progression state, duplicate/reconnect handling, and automatic reward rules. This cannot be verified or delivered solely by changing the display.

## P2 — gift catalogue data snapshot

### P2-37 — Gift catalogue is populated and media filename fallback currently resolves all active gifts

**Status:** Confirmed — live DB and repository asset filenames. The current database has 96 gift records: 90 active and six inactive; prices range from 1 to 100,000 coins. All 90 active names have corresponding website artwork, animation and sound filenames under the current generated-slug convention. The `asset_key` and `sound_url` columns being empty are not, by themselves, a defect because current source builds media paths from gift names and keys. The real confirmed parity defect is the stale/different Android artwork and animations, plus the four missing multi-guest SVGs. Preserve this distinction in the fix; do not rewrite catalogue metadata without evidence.

### P2-38 — Wallet coin packages currently contain six active USD packages

**Status:** Confirmed — live DB snapshot. `public.coin_packages` contains six active packages, with prices from USD $0.99 to $99.99. The custom-amount feature is still missing. Any later implementation must calculate/validate the price on the server and preserve PayPal as the currently intended provider; no client-trusted price or wallet credit is acceptable.

## P2 — migrations and validation gaps

### P2-39 — Live migration ledger diverges from repository migration filenames/order

**Status:** Confirmed — repository vs Supabase migration ledger. The live ledger has 19 records while the repository contains 26 numbered migration files. The ledger includes applied migrations with prefixes reused for distinct purposes (for example, several 0027–0033 entries) and a live-room migration recorded as `0027_live_room_experience`; the repository’s `0025_live_guest_request_workflow.sql` is not in the live ledger. The live guest check confirms its intended `requested` value has not reached production. Use actual schema introspection to create a new forward-only migration with a unique timestamp/version and record it through the supported migration process; do not replay all SQL by filename or edit migration history manually.

### P2-40 — Automated CI success does not include the required verification gates

**Status:** Confirmed — workflow source + successful run metadata. GitHub Actions produced a debug APK, but the workflow currently runs Gradle assembly without first syncing web assets or running `npm run check`. This is a pipeline coverage gap: the build success proves only that the APK assembled, not that frontend/backend contract tests passed or that the embedded website is current. The full suite, asset parity assertions, and APK identity/version/signature checks must run before a release artifact is considered verified.



## P1-41 — Auth failures are high-volume and may be amplified by retry/parallel API calls

**Status:** Confirmed — Render log query. A bounded query returned 100 `Invalid or expired Supabase session.` entries with `hasMore=true`, so the count is **at least 100** in the queried audit window, not an exact total. `Auth session missing!` also returned 100 entries with `hasMore=true`. Many events occur within fractions of a second around 15 October 02:48 UTC, indicating several authenticated requests are failing in a tight burst. This is more than an occasional stale login. It may reflect concurrent page boot requests, a missing stored session, or retry behavior; the current evidence does not prove which one.

**Required later repair/verification:** correlate requests by request ID and route; prevent a page from issuing a burst of authenticated calls before session restoration finishes; do not spam retries; refresh at most once per failed request/session epoch; return actionable login-required states; test both normal login and signed-out entry. Ensure logs do not expose access/refresh tokens or sensitive user data.

## P1-42 — Guest constraint failure has 52 matching production log entries

**Status:** Confirmed — Render log query. A search for `live_guests_status_check` returned 52 matching entries in the available audit window. This confirms the guest-stage issue has been recurring, not a single typo reported once. The live table currently contains zero guest rows, and its check constraint excludes `requested`.

## P2-43 — LiveKit token endpoint has succeeded, but this does not validate two-way media

**Status:** Partially verified — production request logs. Sampled `/api/livekit/token` OPTIONS requests returned 204 and POST requests returned 200. This confirms that the token endpoint can respond successfully for at least some requests. It does **not** prove that camera/microphone permissions are granted, the participant joins the correct room, host acceptance updates publish permission, tracks are published/subscribed/attached, or remote video appears on both devices. Those remain mandatory two-account/device acceptance tests.

## P2-44 — Public HTTP/browser probe is not conclusive

**Status:** Not verified — tooling limitation. A direct open attempt against the two Render URLs and common health paths was rejected as “not accessible via this tool.” This is not evidence that the sites are down; Render reports both services as active/healthy. A real browser/curl/device probe is still needed to confirm HTTP status, redirects, CSP/CORS, static asset delivery, API reachability and route fallback.


## P2-45 — Static route/link audit and duplicate root registration

**Status:** Static source check completed. The current frontend has 74 unique registered route paths and 99 literal internal hash links. All 99 resolve to a registered route under the router's longest-prefix matching behavior, including profile/post/live/team detail links and legal/help pages. The backend API scan found 50 literal frontend API call sites across 21 unique paths; dynamic route handlers in `team-leagues.js`, `creator-leagues.js`, `teams-routes.js`, `payout-routes.js`, `live-room-experience.js` and `server.js` cover the paths that do not appear as simple literal route strings. This does not replace runtime HTTP testing.

One duplicate route registration is present: `/` is registered in both `frontend/src/pages.js` and `frontend/src/studio-edition.js`. The router explicitly records duplicate registrations and the later registration wins. This may be an intentional edition override, but it creates a warning and makes route behavior dependent on script load order. Consolidate the root route or document/test the intended override during the repair stage.

## P2-46 — Service-worker cache version can keep old gift visuals after asset replacement

**Status:** Confirmed — source-level cache behavior risk. `frontend/sw.js` uses the fixed cache version `chcn-web-nexus-v6-0-2`. Its fetch handler uses cached-first behavior for most same-origin assets, including gift artwork and animations, while scripts/CSS/index use network-first behavior. If gift files are replaced under the same filenames without changing the service-worker cache version or explicitly refreshing those entries, already-installed web/PWA clients can keep the older cached artwork. The Android asset mismatch is confirmed separately. The release process should bump the service-worker version when cacheable assets change, or use a deliberate asset-revalidation strategy, and test an existing installed PWA across an update.

## P1-47 — Project identity in the deployed source is inconsistent with the CHL project name

**Status:** Confirmed — source metadata. The repository is `creator-hub-live`, but the root `package.json` name/description, current frontend document title, web manifest name, service-worker version/comment, README and some UI copy identify the application as **Creator Hub Creator Network**. This is a project-identity mismatch for the Creator Hub Live target and risks shipping the wrong brand/copy into the website and APK. The repair must first verify the intended CHL branding for this repository, then update all user-visible metadata and installed-app labels consistently; do not rename the separate Creator Hub Creator Network project or mix its assets into CHL.

## P2-48 — Legacy external-platform configuration property remains in browser config

**Status:** Confirmed — source. `frontend/config.js` still defines a legacy `TIKTOK_USERNAME` compatibility property from configuration. No user-facing use was found in the frontend source scan, but it is a leftover integration reference and should be removed during the approved copy/config cleanup. The current `tests/integration-check.js` also asserts that the property exists and is empty, so that test must be updated when the property is removed. The Analytics visible text is already recorded separately in P2-16.


## P2-49 — Android backup policy needs review because the WebView persists authentication state

**Status:** Confirmed — source configuration; exploitability/backup contents not directly tested. `frontend/src/core.js` configures Supabase Auth with `persistSession: true`, which stores session state in browser storage by default. The Android `MainActivity` enables WebView DOM storage, and `android/app/src/main/AndroidManifest.xml` sets `android:allowBackup="true"`. The combination warrants a review of whether WebView local storage/auth state is included in device/cloud backups and whether it can be restored onto another device. This is not proof that a token was extracted. Decide the intended backup policy, add appropriate Android backup/data-extraction rules or disable backup where suitable, and test sign-out/reinstall/restore behavior without weakening normal session persistence.

Research: [Android Auto Backup](https://developer.android.com/identity/data/autobackup), [Supabase JavaScript Auth session persistence](https://supabase.com/docs/reference/javascript/auth).

## P2-50 — Authentication and LiveKit SDKs are runtime CDN dependencies without Subresource Integrity

**Status:** Confirmed — source. The website and bundled Android HTML load pinned UMD scripts for Supabase JS and LiveKit Client from a public CDN at runtime; the script tags do not include Subresource Integrity hashes. If the CDN is unavailable or blocked, authentication or LIVE can fail even when the backend is healthy. If the script content served at the pinned URL were compromised, it would execute in the application origin and could interact with the browser session. Assess whether to bundle reviewed SDK files locally or add verified SRI hashes and a controlled update process. This is a supply-chain/availability review, not evidence of an active CDN compromise.


## P2-51 — Targeted relational-integrity checks are clean, but the production sample is too small to prove feature completion

**Status:** Confirmed — read-only SQL checks. The current snapshot has four profiles (all active, nonblank usernames/display names), four wallets with no missing profile, and 87 LIVE-session rows whose host IDs all resolve to profiles. No duplicate case-insensitive usernames were found. `gift_transactions` currently has zero rows; `teams` has zero rows; `league_seasons` has zero rows; `creator_missions` and mission claims have zero rows. These checks found no orphan rows in the tested relationships, but the empty feature tables mean successful real gift settlement, team lifecycle, league-season and milestone flows cannot be inferred from the current data. A staging test matrix must create controlled test fixtures/accounts rather than inventing production rows during this audit.


## P2-52 — Service-worker precache manifest omits three of the four multi-guest layout assets

**Status:** Confirmed — source manifest comparison. The website gift asset manifest lists 277 assets and includes `./assets/gifts/multi-guest.svg`, but it does not list the individual `grid-2.svg`, `grid-3.svg`, `grid-4.svg`, or `seat-empty.svg` files that exist in the multi-guest asset folder. Because the service worker uses this manifest to pre-cache gift/media assets, these four layout assets are not guaranteed to be available immediately offline after install. Combined with the Android copy missing those files, this is a cross-client asset packaging gap. Add the correct paths to the manifest and ensure the Android sync pipeline copies them; verify all referenced asset URLs exist and load on web/PWA and Android.


## P1-53 — Android password-reset/verification redirects target an app-assets-only origin

**Status:** Confirmed — source + Android manifest; runtime email round-trip not tested. In `frontend/src/pages-extra.js`, password reset and verification resend build redirect URLs from `location.origin + location.pathname`. Inside the APK, the page runs at `https://appassets.androidplatform.net/assets/web/index.html`. That origin is supplied by the app's WebView asset loader; it is not a publicly hosted reset page. `AndroidManifest.xml` has only the launcher intent filter and no HTTPS App Links/custom-scheme callback for Auth. A user opening the email on the device may therefore land in an external browser that cannot serve the app-assets page. The reset redirect also uses a hash-router path (`#/reset-password`), which must be tested against Supabase's recovery token fragment handling. Separately, `frontend/src/pages-auth.js` calls `signUp()` without an explicit `emailRedirectTo`, so signup confirmation relies on the Supabase Site URL/email template defaults and has no explicit app callback.

**Required repair after authorization:** Use a real HTTPS auth callback/landing page that works in an external browser, or implement and verify Android deep links/app links with proper intent filters and allowed redirect URLs. Handle the recovery session and route to the reset form only after the Supabase `PASSWORD_RECOVERY`/session callback is confirmed. Configure Supabase Site URL, redirect allow list and email templates together. Test signup confirmation, resend, password reset, expired/used links, external mail clients, browser and Android app. Do not add `appassets.androidplatform.net` as a public callback without a deliberate, verified flow.

Research: [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase password reset flow](https://supabase.com/docs/guides/auth/passwords), [Supabase email templates and mobile deep linking](https://supabase.com/docs/guides/auth/auth-email-templates).

## P2-54 — Registration does not collect full/display name or date of birth

**Status:** Confirmed — frontend and live schema. `frontend/src/pages-auth.js` currently asks for username, email and password; it initializes `display_name` to the username. The live `profiles` table has `username` and `display_name` but no full-name or date-of-birth columns. This does not meet the requested registration experience. Before adding DOB, define the minimum-age policy and why the date is necessary, keep it private, set strict validation/RLS, and update the privacy notice. Do not expose DOB on public profiles or collect it without a defined purpose.


## P2-55 — Render backend has no configured health-check path

**Status:** Confirmed — Render service configuration. The backend service's `healthCheckPath` is empty even though the source exposes `/api/health`. Render reports the service as active/healthy, but without a configured application health-check path that status is not a strong test that the Node handler and required dependencies are ready. After confirming the health endpoint's intended response and whether it should check Supabase reachability, configure the Render health check and verify deployment rollback/readiness behavior. Do not make the health endpoint expose secrets or fail liveness solely because an optional provider is temporarily down.

## P1-56 — Render's static frontend deploy has no build/test gate

**Status:** Confirmed — Render service configuration. The static site uses `buildCommand: echo "static frontend"` and publishes the `frontend/` directory directly. This means Render does not execute the root project check suite or the Android asset sync script before publishing a frontend commit. The Android GitHub workflow also currently assembles a debug APK without those gates. Add explicit CI checks and asset parity validation before a coordinated release; keep production changes manual as requested.

## P1-57 — The expected release APK is not present at the checked repository path

**Status:** Confirmed — repository lookup, release manifest and workflow inspection. The specific path `releases/creator-hub-live-release.apk` and `releases/STATUS-2026-10-14.txt` return 404 on current `main`, but the repository does contain `releases/creator-hub-live.apk` at 25,729,472 bytes; its only path commit is “Add files via upload” on 14 October 2026. The `RELEASE-MANIFEST-NEXUS-6.0.2.json` explicitly says the Nexus 6.0.2 APK was **not rebuilt or signed** and that historical APKs were preserved. The GitHub connector cannot inspect the binary APK internals here, so its actual version/signature and behavior remain unverified. The latest successful GitHub Actions workflow creates a **debug** APK artifact under `android/app/build/outputs/apk/debug/`; it does not publish a release-signed APK into the repo's `releases/` directory. Android Gradle declares versionName `6.0.2` and versionCode `62`, but no APK was installed or tested on the user's device during this audit. Do not treat `releases/creator-hub-live.apk` or the debug artifact as a repaired release until its embedded source/assets, version, signature, checksum, installation and device acceptance are verified.


## P2-58 — Root route overwrite is not caught by the duplicate-route test

**Status:** Confirmed — static test/code comparison. The live source declares `/` using `CHL.route('/')` in `frontend/src/pages.js`, then replaces `CHL.routes['/']` directly in `frontend/src/studio-edition.js`. That second assignment is an intentional homepage replacement in the current design, but it bypasses the runtime duplicate-registration detector. The integration test regex for direct assignments uses `\/[^'"]+`, which does not match the root-only path `/`; therefore it will not report this override as a duplicate. This is **not** evidence that `npm run check` currently fails. It is a test/maintainability gap: the check should explicitly support root routes and distinguish a documented homepage replacement from accidental duplicate registration, or the source should register the final homepage once.

## P2-59 — Existing gift tests do not enforce Android media parity or all multi-guest layout files

**Status:** Confirmed — test coverage gap. `tests/gift-asset-contract.mjs` validates the website gift assets and checks the single `assets/gifts/multi-guest.svg`, but it does not compare website asset hashes with the Android bundled copies and does not assert presence of `grid-2.svg`, `grid-3.svg`, `grid-4.svg`, and `seat-empty.svg`. `tests/live-gift-mobile-release-contract.mjs` checks the existing service-worker version string rather than asserting that the cache version changes with assets. Thus the stale Android artwork/animations and missing layout SVGs can pass current static contract checks. Add automated parity checks and require all referenced assets to exist in the web manifest and Android bundle.


## P2-60 — Six RLS-enabled tables with no policies still grant broad table privileges

**Status:** Confirmed — live catalog query. Among the 16 tables with RLS enabled and no policies, `audit_log`, `match_participants`, `matches`, `referrals`, `sounds`, and `taps` still report SELECT/INSERT/UPDATE/DELETE table privileges for both `anon` and `authenticated`. Because RLS is currently enabled and no policies exist, these roles should still be denied rows/writes by the policy layer; this query does **not** prove the tables are presently exposed. The grants are nevertheless excessive for sensitive audit/ledger-adjacent data and create unnecessary risk if RLS is later disabled or a policy is added too broadly. Revoke grants that are not needed and add only intentional narrow policies through a reviewed migration. Ten other no-policy tables have no such client grants and appear consistent with service-role-only storage.


## P1-61 — Broad `TRUNCATE` and DML grants exist on financial/catalogue tables despite RLS

**Status:** Confirmed — effective database privilege query; direct exploitation not demonstrated. `anon` and `authenticated` have effective TRUNCATE privileges on **50 of 62 public tables** and broad INSERT/UPDATE/DELETE/TRUNCATE privileges on sensitive tables including `wallets`, `coin_ledger`, `diamond_ledger`, `gift_transactions`, `gifts`, `creator_missions` and `creator_mission_claims`. Most of these tables have RLS policies that permit only narrow reads or explicitly deny client writes, so the observed grants alone do not prove that ordinary PostgREST requests can mutate those rows. However, PostgreSQL `TRUNCATE` is not governed by row-level policies, and these broad grants are unnecessary for client roles. The standard Data API does not expose a generic `TRUNCATE` endpoint, so no successful destructive request was observed; treat this as a high-priority privilege-hardening defect and possible risk amplifier if another SQL/RPC execution path is misconfigured.

**Required repair after authorization:** Audit grants inherited from `PUBLIC` and role defaults; revoke unnecessary table/sequence/function privileges from `anon` and `authenticated`; regrant only the exact SELECT/INSERT/UPDATE/DELETE permissions required by each table and policy. Preserve server/service-role access and all existing user-facing reads. Test allow/deny behavior for every wallet, ledger, gift, mission, payout and LIVE operation as anon, regular authenticated user, owner/host and admin. Do not run a blanket revoke until all client paths are mapped.


## P1-62 — Confirmed CSS cascade makes text nearly invisible on white cards

**Status:** Confirmed — source and contrast calculation. `frontend/styles/studio-edition.css` defines a light surface (`.studio-outlet .card { background:#fff; }`), while `frontend/styles/nexus-edition.css` is loaded after it and globally forces `html,body` text to `#f3f6ff`. The base `.card` rule in `app.css` does not set a foreground color, so text in cards that does not declare its own color inherits the near-white body color. The contrast ratio of `#f3f6ff` text on `#ffffff` is approximately **1.08:1**, far below WCAG's 4.5:1 target for normal text. This directly explains the reported white-background readability problem on pages using the Studio light-card styles. Some components set explicit text colors and may not be affected; the defect is the global theme cascade, not every component.

**Required repair after authorization:** Choose one coherent theme per page or set foreground colors at the surface/component level. Do not apply a generic CSS override. Test cards, forms, settings, analytics, auth, dropdowns, disabled/selected states and error notices on phone/tablet/desktop in both themes. Add automated contrast checks for design tokens and a visual regression pass for the actual page components.


## P2-63 — Build inputs are not fully reproducible

**Status:** Confirmed — repository tree and build configuration. The repository has no root/backend `package-lock.json` and no Android Gradle wrapper (`gradlew`/`gradle/wrapper`). The backend declares ranged npm dependencies (`^2.45.4`, `^2.19.1`, `^17.2.1`) and Render installs from `backend/package.json`; dependency resolution can change between builds. The Android workflow invokes `gradle assembleDebug` without a repository-pinned wrapper distribution. The last build succeeded, but future runner/dependency changes could alter behavior or break the build without a source change. Add a reviewed lockfile and use `npm ci`; add a Gradle wrapper pinned to a compatible Gradle version and run the same release checks in CI before building the APK.


## P3-64 — Ninety GLB model files appear unused and need asset-quality verification before use

**Status:** Needs inspection — repository metadata only. The `models/` directory contains 90 GLB files sized 856–876 bytes, with 80 unique Git blob hashes and eight duplicate-hash groups. No references to these `.glb` files or a model-viewer/GLTF renderer were found in the scanned frontend source. Their binary geometry could not be validated through the text-only repository connector. They may be unused historical files or tiny stand-ins; do not describe them as production-ready realistic 3D gift assets until the geometry is opened and visually verified. The currently used gift art/animation/audio is tracked separately under `frontend/assets/gifts/`.


## Verified controls and clean checks (read-only)

- All 62 current `public` base tables have RLS enabled; none is configured with `FORCE ROW LEVEL SECURITY`. This is a good baseline, but the missing-policy and broad-grant findings above still need attention.
- `profiles.is_admin` is not selectable or updateable by `anon`/`authenticated` through ordinary table grants; `account_status`, `gifter_level`, follower counters and other protected fields are not updateable by ordinary authenticated clients. `username` and `display_name` are updateable by authenticated clients, subject to the profile RLS policy.
- A read-only sweep checked all 101 declared foreign-key constraints across 55 child tables; every relationship returned zero orphan rows. Targeted checks also found no orphan host profile IDs across 87 LIVE sessions, no orphan profile IDs among four wallets, and no duplicate case-insensitive usernames. There are only four active profiles total, so clean referential integrity is not a substitute for multi-account acceptance tests.
- All 90 active gifts have matching website artwork/animation/sound filenames under the current asset-key fallback. The defect is Android media parity and missing multi-guest layout assets, not missing active gift filenames.
- The static route check found 74 unique frontend route paths and 99 internal hash links; every link resolves through the router's longest-prefix matching. The separate duplicate `/` registration is a test/maintainability issue, not evidence that those 99 links are broken.
- Production logs show some successful `/api/livekit/token` responses, but that does not verify camera/microphone permission, actual track publishing/subscription or two-device guest stage behavior.

## Final audit status

**This is an audit register, not a repair confirmation. No live changes were made.** The report now includes live production error-log volume checks, a live schema/data snapshot, repository-vs-Android asset comparisons, CI workflow review, and the Supabase security/performance advisor findings. Critical issues and confirmed mismatches are recorded; prior UI/network reports still need route-by-route/browser/device reproduction. After the owner approves the repair stage, implement one coordinated full-project update, run all automated checks, and perform real staged connection/device acceptance. Do not call any error fixed until the relevant test passes with evidence.


## Audit correction — route-test claim withdrawn

The earlier draft incorrectly labelled P1-58 as a likely root `npm run check` failure. The route-test regex excludes `/` as a directly assigned route, so the asserted failure did not follow from the code. The finding has been downgraded to P2-58 as a real detection gap, not a test failure. The local historical source package at Nexus 6.0.0 was also checked separately: its `npm run check` completes with **248 passed, 0 failed**. That local result is explicitly not being represented as the current repository's full 6.0.2 test run or as a production/device acceptance test.

## Latest repository CI artifact cross-check

GitHub Actions run **#45** (`38629260442`, commit `3f5d0f1ce76d2120e538939ee56ff94ca43046e2`) completed successfully on 14 October 2026 and produced one artifact named `creator-hub-android-debug`. The downloaded APK inside it is a 19,778,090-byte debug package. Its bundled frontend includes the current Nexus 6.0.2 source files and gift media, but the audit's website-vs-Android asset comparison found the bundled art/animations differ from current website source and it omits four multi-guest layout SVGs. The successful build means Java/Android packaging succeeded; it does not mean the root release tests ran (the checked-in workflow doesn't invoke them), that the APK is release-signed, or that the APK has been installed and exercised on a physical phone. The 25,729,472-byte repository file `releases/creator-hub-live.apk` is a separate binary; the connector could not inspect its APK manifest/signature, so it remains **unverified**, not declared old or repaired.
