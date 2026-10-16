# Creator Hub Live — diamond payout workflow

## Creator steps
1. Sign in and save the intended PayPal email in **Settings → Payments**.
2. Open **Wallet → Withdraw diamonds to PayPal** and enter a whole-number diamond amount.
3. Submission atomically reserves the diamonds and writes a negative `diamond_ledger` entry. The request appears in payout history as `pending`.
4. The request does not display a calculated fiat amount until an authorized administrator confirms one.

## Administrator steps
1. Open **Admin → Payouts** and review the diamond amount and PayPal destination. Independently verify the destination and the creator's eligibility under the platform's policies.
2. For approval, enter the exact payable fiat amount and three-letter currency code. No diamond-to-fiat exchange rate is configured in this release. The request becomes `approved`; this does **not** send money.
3. Send the approved amount to the listed PayPal account using the authorized PayPal account/workflow. Only after PayPal confirms the transfer, enter its transaction/reference ID and select **Record PayPal payment**. The request becomes `paid`.
4. To reject a pending request, enter an optional reason and select **Reject & refund diamonds**. The database transaction refunds the reserved diamonds and appends a positive `diamond_ledger` entry exactly once.

## Safety and accounting
- Balance reservation/refund and payout status transitions are performed by database functions inside transactions, not by browser balance edits.
- Requests require idempotency keys; duplicate submissions return the existing request rather than reserving diamonds again.
- Admin endpoints validate `profiles.is_admin` server-side. Database RPCs also verify the supplied administrator profile.
- A payout cannot be approved without an administrator-entered fiat amount and currency, paid without an approved status and unique payment reference, or refunded twice by repeating a rejection.
- Audit entries are written for request, approval/amount confirmation, rejection/refund, and paid status.
- PayPal email format is checked, but this build does not run an automated email-ownership verification flow. The administrator must independently confirm the destination before paying.
- PayPal payout execution is manual in this release. PayPal coin checkout is a separate flow and does not imply payout automation.

## Migration
Review the actual database migration ledger before applying `database/migrations/0026_secure_diamond_payout_workflow.sql`. Apply it only after the project's migrations through `0025` have been reconciled on the target database. Do not blindly replay migrations against a production database. This package was assembled from the source archive available in this session and does not independently prove that it contains every file from the current GitHub `main` branch.
