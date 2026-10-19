# Release readiness, deployment, and rollback

## Readiness checklist

- [ ] Intended branch/commit/package and destination are confirmed.
- [ ] Diff contains only approved files; no unrelated code, caches, secrets, or generated bundles.
- [ ] Acceptance criteria link to test evidence.
- [ ] Risk class and reviewer/owner decision are recorded.
- [ ] Database preflight, migration order, backup and post-migration checks are complete if applicable.
- [ ] Frontend/backend API compatibility and required environment variables are checked.
- [ ] RLS/auth/role boundaries and privacy behavior are tested for applicable paths.
- [ ] Desktop, mobile and Android wrapper parity are checked where applicable.
- [ ] PayPal, wallet/coins, gifts, diamonds, LiveKit and other real integrations are tested in their correct safe environment or explicitly marked BLOCKED/NOT RUN.
- [ ] Known issues, monitoring signals, rollback/compensation and owner are listed.
- [ ] User-facing status and release notes do not claim tests that were not run.

## Manual ZIP acceptance

For a manual-install package, include a file manifest with one of: **ADD**, **REPLACE**, **REMOVE**. `REMOVE` is prohibited unless specifically requested and reviewed. Identify the exact destination, explain each replacement, preserve backups, test ZIP integrity, calculate a SHA-256 checksum, and provide the specific installation order. Avoid nested duplicate project roots and do not overwrite user changes without showing the diff.

## Safe rollout sequence

1. Freeze the intended artifact and record its checksum.
2. Confirm approval and target environment.
3. Apply the lowest-risk dependency order first; deploy compatible backend/schema prerequisites before consumers only when the reviewed plan requires it.
4. Run immediate health/smoke checks and affected user journeys.
5. Review logs and metrics for a defined observation window.
6. Declare success only if the required checks pass. If a critical signal regresses, stop further rollout and invoke the approved recovery plan.

Current repository Actions include an Android debug-build workflow; that is not proof of a production deployment. The documentation quality workflow added by this package checks documents only and does not deploy the website or backend.

## Rollback versus compensation

- **Static frontend:** restore the last known-good build/source; clear caches only when required and planned.
- **Backend:** redeploy the last known-good compatible version or apply a forward fix. Check compatibility with any already-applied schema changes.
- **Database:** prefer a tested compensating migration; do not automatically run a “down” migration if it would destroy user data or conflict with concurrent writes.
- **Wallet/payment/gifts:** preserve the ledger and transaction audit. Use reviewed reversal/compensation operations, not direct balance overwrites.
- **Android:** verify the release signing identity before distributing updates. A newly built APK is not necessarily installable as an update if the signing identity changed.
- **Live sessions/media:** contain the outage, prevent new broken sessions if approved, preserve existing state/evidence, and recover room lifecycle without fabricating viewers or transactions.

## Post-release record

Record commit and artifact hash, target, release time, checks, observed outcomes, issues, roll-forward/rollback decision, and follow-up tasks. Keep historical reports immutable; add a new report for a new run rather than rewriting the old outcome.

## Reference

- [GitHub Actions — Controlling deployments with environments and protection rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
