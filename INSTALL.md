# Creator Hub Live — Device, Icon, Model & Verification Upgrade

**Package type:** one coordinated manual-install bundle. It contains a small, explicit iPhone entry replacement plus additive icons, scripts, tests, and verification docs. It does not modify the live site, GitHub, Supabase, Render, wallet data, gift prices, or existing model files.

## Install

1. Back up the repository or create a local commit.
2. Extract this ZIP at the repository root, preserving paths.
3. Review `frontend/index.iphone.html` before replacing the existing file. This replacement corrects CHCN branding to CHL and keeps the existing script/CSS entry points.
4. Add the new files under `frontend/assets/chl-icons/`, `scripts/`, `tests/`, `verification/`, `models/`, `patches/`, and `docs/` as extracted. These paths are additive.
5. From the repository root, run:

   ```sh
   node scripts/audit-chl-assets.mjs
   node tests/device-readiness-contract.mjs
   node scripts/sync-web-assets-safe.mjs --check
   ```

6. Review all output. If the checks are clean, synchronize web assets to Android only when you intend to:

   ```sh
   node scripts/sync-web-assets-safe.mjs --apply
   ```

   The safe sync copies new/changed files and **does not delete** files from the Android destination. It prints a report before copying when run with `--check`.

## Boundaries

- Existing 3D gift models are audited, not replaced. A structurally valid GLB is not proof that its artwork is visually correct or sufficiently detailed; inspect warnings and preview the model in a GLB viewer before approving it.
- These are source-level and static checks. They do not prove successful builds, real camera/microphone use, PayPal settlement, LiveKit connectivity, iOS installation, or physical-device behavior.
- iPhone support remains the existing web/PWA entry, not a native IPA. This bundle does not claim to build or sign an iOS app.
- No remote services or deployed systems are changed.
