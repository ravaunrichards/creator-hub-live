# CHL device and release verification matrix

This is a test plan, not a claim that every device has been tested. Record browser/OS version, build or commit, viewport, outcome, and evidence for every executed test.

| Target | Required checks | Evidence required before PASS |
|---|---|---|
| Android phone (small, 360–390 CSS px) | login, feed, profile, LIVE controls, guest layout, chat keyboard, gift sheet, wallet, safe areas, rotation | real browser/WebView or emulator run; screenshots; console/network log |
| Android large phone/foldable | folded/unfolded, window resize, keyboard, split-screen, camera/mic permission denial and recovery | emulator/device results in both postures |
| Android tablet (600+ dp) | navigation, list/detail layouts, dialogs, LIVE stage, pointer/touch, portrait/landscape | emulator or device evidence |
| iPhone Safari | viewport-fit/safe areas, auth/session restore, media permissions, orientation, PWA install, resume from background | physical iPhone or trusted iOS device-lab evidence; Safari console where available |
| iPad Safari | split view, orientation, external keyboard, touch targets, popovers, video layout | device/lab evidence at compact and expanded widths |
| Desktop Chrome/Edge/Firefox/Safari | keyboard-only operation, focus visibility, resize, overflow, permissions, WebRTC device selection | browser/version matrix and screenshots/logs |
| PWA/offline/reconnect | first load, cached shell, offline message, reconnect, stale cache update | network-throttling run and service-worker evidence |
| Reduced motion/accessibility | prefers-reduced-motion, zoom/text scaling, screen-reader labels, contrast, focus order | manual accessibility review plus automated scan |
| LIVE/WebRTC | host camera/mic, guest join/leave, reconnect, audio routing, screen-share where supported | two real participants and real media devices; server logs |
| Wallet/gifts/payments | display only server values; idempotent transaction behavior; PayPal return/cancel/error | sandbox transactions and ledger verification; never use fabricated balances |

## Release gate

- [ ] `node scripts/audit-chl-assets.mjs` exits 0; every warning is reviewed, not ignored.
- [ ] `node tests/device-readiness-contract.mjs` exits 0.
- [ ] `node scripts/sync-web-assets-safe.mjs --check` report reviewed; no unexpected destination-only files are deleted.
- [ ] Existing integration and backend tests pass in the full repository.
- [ ] Android debug build/install is verified on emulator/device; release signing identity checked before a release build.
- [ ] iPhone/iPad Safari and PWA behavior is tested. A web entry is not an IPA.
- [ ] Responsive widths tested at 320, 360, 390, 430, 600, 768, 1024, 1280 and 1600 CSS px; also test landscape, browser zoom, keyboard and multi-window.
- [ ] No critical console errors, horizontal overflow, unreachable controls, unlabelled icon-only buttons, or missing media assets.
- [ ] Production backend, Supabase/RLS, LiveKit, and PayPal are verified separately; static checks are not substitutes.
- [ ] Rollback files/commit and evidence are recorded.
