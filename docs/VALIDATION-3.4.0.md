# Release 3.4.0 Validation Boundaries

## Automated local checks

Run from the project root:

```sh
npm run sync:android-web
npm run check
```

`npm run check` covers structural source checks, frontend/backend source-security patterns, static deployment/payment contracts, Teams/league contracts and the backend tests. The integration check additionally syntax-checks every shipped frontend `src/*.js` module and requires the packaged web tree to exactly match `frontend/`.

## Not represented by the automated suite

Passing source tests does **not** prove production credentials, live database schema, RLS, storage policies, OAuth, real PayPal payment/capture/webhooks, real LIVEKit audio/video, mobile physical-device layout or external-provider uptime. Apply no SQL just because a local source check passes. Use the release preflight against the actual Supabase environment and review its missing items first.

## Manual acceptance checklist

- [ ] Verify `/api/health` reports backend release `3.4.0` and the intended PayPal environment.
- [ ] Confirm frontend and backend deployment URLs and current public Supabase URL/key match the intended project.
- [ ] Apply only reviewed migrations after database backup; rerun the read-only preflight.
- [ ] Test account creation/sign-in/password reset and profile editing with a test account.
- [ ] Test create public text post, supported public media upload, like/unlike, comment, save/unsave, repost/unrepost, follow/unfollow, direct-message send/read, notifications and report submission.
- [ ] Test Academy progress on the same user across two sessions after migration 0021.
- [ ] Test live PayPal with the smallest available package and reconcile create → approval → capture → exactly-once wallet credit. Verify pending/failed orders do not credit.
- [ ] Test LIVEKit only with approved server credentials and at least two real devices/accounts.
- [ ] Check narrow Android phone portrait, phone landscape, tablet and desktop: no forced two-column dashboard, clipped controls, hidden form actions or excessive horizontal scrolling.
- [ ] Verify offline games and phrasebook without connectivity; confirm online-only tools show honest offline/error states.

No seeded user, post, wallet balance, match, score, course completion, payment or certificate is added by the release migrations.
