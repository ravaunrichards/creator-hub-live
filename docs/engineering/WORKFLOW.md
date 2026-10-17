# Engineering workflow: request to verified release

## 1. Intake and qualification

Capture the user problem, affected page/route, expected behavior, current behavior, device/browser, repeatable steps, severity, and evidence. Do not include secrets, private conversation contents, payment credentials, or production access tokens. If the request references several apps/platforms, translate that into capabilities and outcomes before proposing integrations.

Before accepting the work, search the current code, routes, schema, migration ledger, package scripts, docs, and tests for an existing implementation. Identify whether the issue is a missing feature, a broken existing feature, a configuration problem, or a documentation gap. Preserve known working flows.

## 2. Audit and plan

Write a compact finding set:

- **Observed:** reproducible facts and source paths.
- **Expected:** user-facing acceptance criteria.
- **Cause:** confirmed root cause, or hypothesis clearly labelled as such.
- **Scope:** exact files/routes/tables/services likely affected.
- **Risks:** authorization, user privacy, payments, realtime state, schema compatibility, responsive UI, Android parity.
- **Verification:** exact commands and manual steps.
- **Rollback:** how to disable/revert safely without corrupting balances or user data.

Use `docs/engineering/templates/TECHNICAL-DESIGN.md` for R2/R3 or cross-system work. Use an Architecture Decision Record (ADR) when the decision has a lasting impact or there are meaningful trade-offs.

## 3. Implement the smallest complete fix

Follow the dependency order: fix broken existing routes/contracts first; then make the change at its authoritative layer; update consuming UI and platform wrappers; add tests; update the relevant documentation. Do not invent a parallel table, endpoint, state machine, or copy of an existing feature without proving it is required. Do not fold an unrelated cleanup into a high-risk fix.

For backend and database behavior, confirm actual schema/function/policy names before writing SQL. For wallet and gift behavior, keep prices and settlement server/database-authoritative and idempotent. For LIVE, explicitly handle requested, accepted, connected, disconnected, ended, and failed states if those states apply. For style/theme experiments, do not claim two styles are compatible just because each looks acceptable alone.

## 4. Verify at the change's risk level

Run the existing applicable scripts listed in [Quality gates](QUALITY-GATES.md). Add targeted tests for the bug or contract. Then verify all relevant user paths, including denied access, expired sessions, network loss, duplicate requests, empty states, long content, and retry behavior where applicable.

For responsive/theme work, test individual styles and proposed combinations on the same routes and viewports; capture computed conflicts, overflow, inaccessible contrast, overlapping controls, console errors, and interaction regressions. Keep an explicit allowlist of tested combinations; all other combinations remain unverified.

For integrations, distinguish source/static tests from live-provider tests. A mocked API test does not prove the real provider works. A green CI build does not prove PayPal settlement, Supabase RLS, LiveKit media, push notifications, or a physical Android install.

## 5. Review and package

Inspect the final diff and ensure every file has a reason to exist. Preserve source history and existing unrelated files. A manual-install ZIP must include a destination manifest, backup instruction, exact file-scope list, test report, and no unexplained replacement files. Verify ZIP integrity and checksum. Do not include `.env`, private keys, generated caches, build outputs, or duplicate project archives unless explicitly requested.

Before delivery, report:

- exact files added/replaced;
- tests actually run and results;
- tests not run and why;
- known risks/limitations;
- manual install steps;
- whether GitHub/Supabase/Render/live services were changed (default: no).

## 6. Release and learn

Follow [Release and rollback](RELEASE-AND-ROLLBACK.md). After release, run post-deployment smoke checks and observe real logs/metrics. A reported issue becomes complete only when the original acceptance criteria are verified or the remaining blocker is documented. Feed useful new findings into docs, tests, monitoring, or an ADR to prevent recurrence.

## State model for work items

`Proposed → Accepted → Auditing → Planned → Implementing → Automated checks → Manual verification → Ready for release → Released → Observed → Closed`

Allowed side states: `Blocked`, `Rejected`, `Rolled back`. A state change should include evidence or a clear reason. “Implemented” is not equivalent to “released” or “verified in production.”
