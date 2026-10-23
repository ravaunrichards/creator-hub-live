# Reference Repository Inventory

Source inspected: `https://github.com/ravaunrichards/creator-hub-live`
(public, “Nexus Edition 6.0.2”). This is a requirements/knowledge reference
only. Creator Hub Live Next is a separate codebase and does not reuse its
source, assets, or deployment.

## Observed structure (top level)

- `android/` — Android WebView wrapper source.
- `backend/` — API / server routes.
- `database/` — migration chain (the repo README references a 26-file chain,
  with migration 0026 noted as additive; historical migrations reusing
  0025–0029 must not be blindly appended).
- `frontend/` — JS-rendered SPA (design-system stylesheet, PWA, `sw.js`).
- `icons/`, `models/` (gift media / 3D assets), `patches/`, `reference/`,
  `releases/`, `reports/`, `scripts/`, `tests/`, `tools/`, `verification/`.
- Many top-level install / recovery / manifest markdown files and
  `package.json` with an `npm run check` aggregate verification command.

## Business rules worth preserving (conceptually)

- Gift pricing and settlement are **database/server authoritative**; shipped
  manifests contain assets, not prices or coin→diamond conversion values.
- LIVE experience includes polls/voting, Q&A, reactions, gift-event history,
  host settings/moderators/analytics, optional recording via LiveKit Egress to
  private S3-compatible storage.
- Coins, diamonds, and cash-like values are distinct and not freely
  interchangeable.
- Automated/headless checks do **not** prove live Supabase/RLS, LiveKit
  recording uploads, PayPal **production** settlement, or device media
  behaviour — the reference README states this explicitly.
- No signed APK could be rebuilt in a toolchain-less environment; the “iPhone
  entry” is a web file, not an IPA.

## Known gaps / cautions carried into the new design

- Sandbox PayPal success ≠ production success (OAuth/merchant config differs).
- A DB row existing is not proof a stream is live or a payment captured — model
  explicit state machines.
- Consumer wallets (e.g. Lynk) do not automatically expose a merchant API —
  verify business access before claiming automated confirmation.

These observations shaped the new ledger, payment-adapter, and state-machine
designs in `src/` and `database/`.
