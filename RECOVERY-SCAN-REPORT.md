# CHL Recovery Scan Report — Updated

## Local repairs applied
- Preserved the larger recovered `frontend/src/pages-wallet.js` rather than replacing it with the smaller October 15 baseline version.
- Added the six configured coin quantity presets (100, 500, 1,000, 2,500, 5,000 and 10,000) with prices requested from the server quote endpoint; checkout is disabled when a valid server quote is unavailable.
- Added a payment-method selection step before PayPal checkout. PayPal is the only enabled provider, so no unavailable provider is advertised.
- Kept PayPal capture, coin conversion and diamond payout actions server-authoritative.
- Synchronized wallet and live-discovery sources with Android WebView copies.
- Filtered home/discovery LIVE queries to `status = live` and `ended_at IS NULL`, and refreshed those lists every 10 seconds.
- Bumped the service-worker cache namespace to `chl-web-v3-3-8`.
- Corrected stale test expectations for the migration path, cache namespace and the current social-feed/style-switcher architecture.

## Important remaining recovery requirement
The saved ZIPs do not contain these source files even though the recovered HTML/service worker references them and the backend test scripts require them. A pinned, non-overwriting recovery script is included at `scripts/restore-missing-source-assets.mjs`. From the project root, run:

```sh
node scripts/restore-missing-source-assets.mjs
```

It fetches only missing files from `ravaunrichards/creator-hub-live` `main`, verifies each downloaded file against its expected Git blob SHA, and never overwrites any existing file. If a pinned SHA no longer matches, it stops on that file instead of accepting changed source. It requires network access when run on the user's machine; this environment could not download the source files directly into the ZIP.

## Still not certified
- The exact `creator-hub-live-creator-pages-update.zip` and the original-interface restoration packages are not available in the Library archive set. This is not a byte-for-byte recovery of those missing packages.
- The pinned missing-source recovery step has not been run here, so the final package still has those listed gaps until that command succeeds.
- Supabase, LiveKit, PayPal production connectivity and an actual Android APK build/device run have not been performed.
- Do not overwrite the user's live repository or deployment with this reconstructed archive without reviewing it first.

## Verification from this environment
- `npm run check`: PASS after the local recovery-contract updates (384 integration checks plus gift, social/profile, style-switcher, UI/UX and wallet contracts).
- `node tests/chl-rank-achievements-contract.mjs`: PASS.
- `node tests/device-readiness-contract.mjs`: PASS.
- `node tests/social-actions-delete-contract.mjs`: PASS.
- `node tests/repair-contract.js`: PASS.
- `npm run backend:check`: BLOCKED because the backend modules and test files listed above are absent in this local archive.
- No browser/device run, live provider test, or APK rebuild was performed.
