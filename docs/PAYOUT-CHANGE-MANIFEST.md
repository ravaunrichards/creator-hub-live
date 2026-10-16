# Local payout configuration — exact file manifest

This manifest lists every file changed or added for the PayPal diamond payout workflow in this ZIP. All edits are local to this package; no GitHub repository or live service was changed.

## Added
- `docs/PAYOUT-CHANGE-MANIFEST.md` — this exact file/change list and validation record.
- `database/migrations/0026_secure_diamond_payout_workflow.sql` — payout-account table/policies, email-change verification reset, payout request table, RLS, atomic diamond reservation/refund, admin review transitions, unique payment reference, and audit log writes.
- `docs/PAYOUT-WORKFLOW.md` — creator/admin operating instructions, manual PayPal payment steps, safety notes, and migration caveat.
- `tests/payout-workflow-contract.mjs` — static regression checks for payout endpoints, atomic ledger semantics, admin review actions, and website/Android parity.

## Edited
- `backend/src/server.js` — admin guard, creator payout history/request routes, admin payout queue/review routes, amount/currency validation, and state-conflict handling.
- `backend/tests/route-check.js` — canonical payout API route checks.
- `docs/API.md` — payout API documentation.
- `docs/LIVE-ROOM-ENTERTAINMENT-CHANGE-MANIFEST.md` — appended payout scope and source-baseline caveat.
- `frontend/src/pages-wallet.js` — creator payout form, history, saved-PayPal-settings link, and status display.
- `frontend/src/pages-admin.js` — admin queue with confirm-amount/approve, reject/refund, and mark-paid controls.
- `android/app/src/main/assets/web/src/pages-wallet.js` — synchronized copy of wallet page.
- `android/app/src/main/assets/web/src/pages-admin.js` — synchronized copy of admin page.
- `package.json` — includes the payout workflow contract in `npm run check`.

## Validation performed
- `npm run check`: passed, 360 checks and 0 failures; the additional payout contract test passed (14 assertions).
- `cd backend && npm test`: passed; 20 canonical backend endpoint strings, backend syntax, and LiveKit contracts passed.
- `node --check` on the edited backend and frontend JavaScript files: passed.
- `npm run sync:android-web`: passed; website web assets synchronized into Android assets.

## Important deployment limits
- Diamond-to-fiat conversion is intentionally not configured. An authorized admin must enter the actual amount and currency.
- PayPal payout transfer is manual in this release. The app does not initiate a PayPal Payouts API transfer; the admin records a PayPal reference only after the transfer is actually sent.
- PayPal email format is validated, but there is no automated email-ownership verification. Admin must independently verify the destination before payment.
- The package was assembled from the source archive available in this session. It has not been proven byte-for-byte identical to current GitHub `main`; this ZIP also does not independently establish that migrations through `0025` are present. Reconcile with the current repository and live migration ledger before deploying or replacing a working project.
