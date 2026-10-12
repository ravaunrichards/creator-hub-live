# Production acceptance checklist — release 4.0.2

Mark an item complete only after observing it in the intended deployment and saving the evidence.

## Backup and configuration
- [ ] Verified target project and hosting services are the existing CHL project.
- [ ] Website and backend source/configuration backed up.
- [ ] Supabase backup/export and current migration inventory saved.
- [ ] Private backend secrets remain server-side; browser config contains only public config.
- [ ] Backend URL, allowed frontend origins/CORS, Supabase URL, media bucket, and LiveKit host checked.

## Database
- [ ] Full schema inventory and creator-community preflight reviewed.
- [ ] All migration prerequisites/columns/functions/constraints/grants/policies reconciled.
- [ ] Migration 0024 reviewed, approved and applied exactly once.
- [ ] PostgREST schema refreshed if required; application restarted/reloaded after migration.
- [ ] RLS verified with anonymous, normal-user, blocked-user, deactivated-user and admin test accounts.

## Account and social
- [ ] Registration saves the requested handle, rejects duplicate/invalid handle, and supports email confirmation.
- [ ] Login/logout/reset-password and expired-session behavior work.
- [ ] Profile text/avatar/cover changes persist; invalid upload, oversized file, duplicate username and network failure show accurate errors.
- [ ] Private/follower-only account, post and comment rules verified with two or more users.
- [ ] Following/followers, blocks/unblock, post likes/comments/saves/reposts and feed visibility work.
- [ ] Direct messaging enforces both block status and recipient message preferences.
- [ ] Notifications correspond to actual events and notification preferences are saved.
- [ ] Data export produces a file and warns about partial failures/limits.
- [ ] Account deactivation and permanent deletion tested using disposable accounts only, after reviewing FK cascade/retention.

## Creator community
- [ ] Creator statistics only reflect stored activity.
- [ ] Gift rankings match real ledger/gift transaction records for each window.
- [ ] Hall of Fame shows only available, permitted rankings.
- [ ] Mission claims require a real active mission goal and manual review.
- [ ] Verification badge appears only after administrator approval.
- [ ] Battles store valid invitation/respond/status activity; no fictional scores, winners or settlements.

## Existing services that must not regress
- [ ] PayPal “Buy Coins” shows the existing checkout journey and uses correct Live/Sandbox credentials.
- [ ] PayPal approval/capture/cancellation/failure and idempotent wallet credit tested with provider evidence.
- [ ] Wallet balance, coin/diamond ledgers, gift send and payout requests remain server/database-authoritative.
- [ ] LIVE host/viewer, camera/mic permission, chat, guest controls, stop/end and reconnect behavior tested.
- [ ] Teams create/edit/join/leave/member controls work.
- [ ] Team leagues/season, fixture generation/results/standings/finalization and admin permissions work.
- [ ] Admin payout review and refunds/paid records remain idempotent; no payout marked paid without a real transfer reference.

## Device, accessibility and release
- [ ] Mobile portrait and landscape, tablet, laptop and desktop layout checked.
- [ ] No unexpected horizontal overflow or controls hidden below the fold at common widths.
- [ ] Keyboard navigation, focus, form labels, contrast, text scale and reduced-motion settings checked.
- [ ] Browser refresh/back/deep link and service worker update work.
- [ ] Empty, loading, offline, permission-denied, API-failure and not-found states are accurate and useful.
- [ ] Local root and backend test suites recorded for the exact installed source revision.
- [ ] Rollback source, service reversion steps and database recovery plan confirmed.

Release owner: ____________________    Date/time: ____________________
Evidence/notes: ______________________________________________________
