# Creator Hub Creator Network — Releases

## Supplied APKs

`releases/creator-hub-live-release.apk` and `releases/creator-hub-live-release-alt.apk` are byte-for-byte identical.

SHA-256:
`b061a97bced2b20d5115fe5bf93b780f30e37d37d8d5bc59a944b9a706e29a0a`

Certificate SHA-256:
`1D:DE:83:C9:77:CE:3A:D7:E7:EE:FF:DA:7C:AD:B0:B0:80:E4:33:CD:0F:11:14:89:A8:34:E1:91:41:EA:FE:46`

## Repository keystore

Certificate SHA-256:
`B6:84:18:EC:AE:2F:31:EA:25:11:AF:55:C9:E6:01:5B:69:2A:1F:04:D0:E3:ED:88:8C:2C:D3:BB:E7:DB:03:4C`

The mismatch means the existing APKs were not treated as the repaired release.

## Required final artifact

`releases/creator-hub-app-release.apk` must only be created after an actual `assembleRelease` build and signature/install verification. It was **not fabricated** in this snapshot because the Gradle wrapper/Android SDK were unavailable.

## Coordinated implementation 3.3.0 (2026-10-12)

A complete source-tree replacement for manual installation. Includes a forward-only Teams schema convergence migration (0018), an operations/payout migration (0019), wallet/gift idempotency and RPC permission hardening (0020), admin season/fixture/result/finalization routes, the creator payout request/settings and admin workflow, PayPal environment normalization, release/cache version 3.3.0, synchronized web assets and new mock/contract tests. See `docs/RELEASE-3.3.0.md` and `docs/FINAL-VALIDATION-REPORT.md` for install order and validation boundaries.

No live database or deployment is changed by this archive. Local checks passed; SQL execution against Supabase and live PayPal/deployment verification remain required. The payout flow records transfers done externally and does not make PayPal Payouts API transfers automatically.


## Coordinated Implementation 3.3.0 — 2026-10-12

Full source-tree continuation for the existing repository. Includes Teams schema convergence (0018), season/fixture and payout operations (0019), wallet/gift schema and RPC hardening (0020), frontend/admin workflows, PayPal environment normalization, manual installation instructions and local regression checks. See `RELEASE-3.3.0.md` and `FINAL-VALIDATION-REPORT.md` for scope and explicit live-verification limits.


## Coordinated Full-Source Release 3.4.0 — 2026-10-12

Continues the existing app with responsive compact settings, corrected canonical social-feed columns, post interactions and creation, database-backed direct messages/notifications, creator learning content and progress, utility and offline-game routes, creator metrics/rankings/LIVE scheduling/gift history/subscription-tier management, updated wallet catalogue/PayPal price contract, three forward-only migrations (0021–0023), expanded local checks and synchronized web assets. See `RELEASE-3.4.0.md`, `INSTALL-3.4.0.md` and `VALIDATION-3.4.0.md`. Local passing checks do not prove live database, payments, provider approvals or real device sessions.
