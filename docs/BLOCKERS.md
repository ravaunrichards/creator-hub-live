# Blockers — external dependencies required to go further

These cannot be resolved inside an automated build sandbox. Each names the
exact missing requirement and the exact external action needed. Nothing below
is faked or marked operational.

## Payments

1. **Visa/Mastercard acquiring (JM settlement).**
   - Missing: a merchant account with a Jamaica-eligible acquirer that accepts
     Visa/Mastercard debit+credit and settles to a JM business account, plus
     its API key, merchant ID, endpoint, and webhook secret.
   - Action: open a merchant account (e.g. evaluate processors such as
     EzeePayments / WiPay / First Atlantic Commerce / Fygaro and confirm
     current eligibility, currencies incl. JMD, fees, settlement, disputes),
     then set `CARD_GATEWAY_*` in `.env`. The adapter is ready.
2. **PayPal production.**
   - Missing: production `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` and a
     configured, verified webhook (`PAYPAL_WEBHOOK_ID`). Sandbox success does
     not prove production works.
   - Action: complete PayPal business onboarding, create a live app, register
     the capture/refund webhook, set env vars.
3. **Jamaican local methods (Lynk / MyCash).**
   - Missing: confirmation that a *merchant* (not consumer) API exists and the
     credentials for it. Until then these run in manual-verification mode and
     stay `pending` until an authorized reviewer confirms receipt.
   - Action: verify merchant/business access + webhook; set `LYNK_API_KEY` etc.
4. **Apple Pay / Google Pay.** Require an approved gateway + domain/merchant
   registration; surface buttons only when eligible.
5. **Google Play Billing / Apple IAP.** Require Play/App Store developer
   accounts and a published app; needed only for in-app digital goods.

## Media & realtime

6. **LiveKit (or equivalent).** Missing `LIVEKIT_URL/API_KEY/API_SECRET`.
   Tokens must be minted server-side. No camera/mic/network-to-cloud exists in
   this build environment, so live media cannot be exercised here.

## Mobile / release

7. **Android APK.** No Android SDK/Gradle toolchain in this environment — a
   signed APK cannot be built or verified here. Build config + instructions are
   the deliverable; the signed build must run on a machine with the toolchain.

## Data services

8. **Hosted Postgres/Supabase.** Migrations are provided but need a live
   `DATABASE_URL` + service-role key to apply and to run the DB-backed store.

## FX

9. **Exchange-rate source.** Currency estimates need a real `FX_RATE_PROVIDER_*`
   feed; without it the converter honestly reports rates as unavailable.
