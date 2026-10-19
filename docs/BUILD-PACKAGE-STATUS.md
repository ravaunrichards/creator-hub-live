# Creator Hub Live — assembled build package status

Build package assembled from the locally available full-project snapshot plus the saved targeted replacement archives and the deep-audit register. This is a source package intended for review and manual upload; it is not represented as an exact export of the latest GitHub `main` tree.

## Source provenance

- Repository: `ravaunrichards/creator-hub-live`
- Branch inspected: `main`
- Latest main version observed through GitHub connector: root `package.json` version `6.0.3`
- Latest main commit observed: `53d4ee434d0d7d15e1d64b3bc0aa8e3d60da7e3f`
- Available full local source snapshot reports frontend version `3.2.0` and was updated with saved targeted files dated 2026-10-15.
- The GitHub Actions run for the latest observed commit succeeded, but its downloadable artifact is the Android debug build, not a complete source archive.

## Local validation performed on this package

- `npm run check` — passed: 359 checks, 0 failures.
- `npm run backend:check` — passed: route checks, secret-pattern scan, and endpoint checks.
- `npm run backend:test` — passed: route checks, syntax checks, and LiveKit contract checks.
- Frontend and Android web copies of the runtime files and gift assets were checked by the repository's integration contracts.

These tests validate this assembled snapshot only. They do not establish that the latest GitHub `main` source has been downloaded, merged, or tested here, and they do not verify production database state or provider credentials.

## Important remaining risks from the audit

1. Verify and rotate any real credentials previously committed in public environment templates; the packaged `.env.example` uses placeholders, but the repository history and deployment settings still need a controlled secret-rotation review.
2. LIVE guest requests can fail against production because the deployed status constraint and the `requested` workflow state do not agree. Apply a forward-only, preflighted database migration after inspecting the live schema and migration ledger.
3. Implement one bounded Supabase session refresh-and-retry path for expired sessions without weakening authorization.
4. Synchronize the full current gift artwork/animation set to Android and add asset equality checks to the release workflow.
5. Fix guest acceptance permissions and LiveKit participant-specific stage tiles, and verify live guest presence updates.
6. Review Supabase RLS/advisor findings and stale LIVE sessions individually; do not bulk-delete sessions or blindly replay old migrations.
7. Verify incomplete wallet/provider flows, LIVE-minute milestones, missions, and league data against the current product requirements before release.

See `docs/audit/DEEP-AUDIT-REGISTER-2026-10-15.md` for detailed evidence and findings.

## Safe release instruction

Do not upload this package over production blindly. First compare it with the current GitHub `main` tree, review the diff, run the CI pipeline, and perform the listed database and secret checks. No live database or deployment changes were made while assembling this package.
