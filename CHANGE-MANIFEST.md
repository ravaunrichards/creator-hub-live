# Creator Hub Live — Upgrade Change Manifest

## Edited files (web source + byte-identical Android WebView mirror)
| File | Change |
|---|---|
| frontend/src/pages-room.js | Dedicated "Stop screen-share LIVE" control wired into syncMediaButtons. |
| frontend/src/pages-teams.js | New deep-linkable CHL.routes['/teams/create'] rendering the real create-team form; legacy /teams route preserved. |
| frontend/src/pages-creator.js | Removed fake "Create-team form"/"Join request sent" toasts; "Create team" now links to #/teams/create, "Join team" calls real POST /api/teams/:id/join. |
| frontend/src/pages-wallet.js | Added 100/500/1000/2500/5000/10000 server-quoted coin presets, selectPaymentMethod() payment-selection step ("Continue to PayPal"), and startPaypalCheckout(); server stays price-authoritative. |
| frontend/src/chl-rank-achievements.js | Restored full 8-tier ladder (Bronze→Silver→Gold→Platinum→Diamond→Heroic→Master→Grandmaster). |
| frontend/sw.js | Cache VERSION bumped v3-3-6 → v3-3-12; offline SHELL expanded with restored page/style assets. |
| frontend/index.html | Cache-bust: platform-responsive.css v6.0.6, swipe-feed.js v6.0.6, sw.js register v6.0.14. |

Android mirrors live under android/app/src/main/assets/web/ and are byte-identical to the frontend source.

## Merge instructions
1. Copy each file over your working tree, preserving the relative path shown above.
2. Keep frontend/* and android/app/src/main/assets/web/* identical (the contract suite enforces byte parity).
3. Hard-refresh / reinstall PWA so the new sw.js cache (v3-3-12) replaces the stale shell.

## Rollback
Restore the previous revision of each listed file from git (git checkout <old-sha> -- <path>).

## Verification status (sandbox, Node v16)
- PASS: wallet-recovery, live-controls, recovery-pages, video-photo-repair, gift-asset, social-profile-messaging-tasks contracts.
- PASS: integration-check 584/6 (the 6 failures are pre-existing orphan assets, out of scope).
- FAIL (not completed): style-switcher-contract, ui-ux-contract — require additional style-system.js/style-switcher.js theme work + platform-tools.css theme-bridge selectors + appearance migration not done in this pass.
- NOT VERIFIED (no capability in sandbox): real browser render, signed Android APK build, live Supabase/LiveKit/PayPal.
