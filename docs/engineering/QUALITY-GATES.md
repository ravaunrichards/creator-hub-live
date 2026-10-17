# Quality gates and verification evidence

## Existing automated commands

Run from the repository root, with the expected Node/npm dependencies installed:

| Command | What it is for | What it does not prove by itself |
|---|---|---|
| `npm run check` | Existing top-level integration, gift asset, social/profile/messaging, and style-switcher contract checks | Production API, live Supabase policies, real wallet settlement, physical device behavior |
| `npm run backend:check` | Backend checks defined by the current backend package | Deployed Render configuration or real external providers unless the script explicitly exercises them |
| `npm run backend:test` | Backend test suite | Live integration correctness when tests are mocked or local-only |
| `npm run backend:smoke` | Backend smoke tests | Every authenticated flow or production dependency |
| `node scripts/validate-docs.mjs` | Documentation files, required structure, and local Markdown links added by this package | Product functionality |
| `npm run sync:android-web` | Existing root script for syncing web assets into Android wrapper locations | Android compilation, signing, installation, or WebView correctness |

Do not assume a command exists just because an older release note mentions it. Read the current `package.json` first. Do not silently rewrite package scripts as part of a docs-only change.

## Risk-based gates

### R0 — documentation only

- Run `node scripts/validate-docs.mjs`.
- Review linked paths, command names, examples, dates, and claims.
- Verify no secrets or private user information are included.

### R1 — isolated UI or copy

- Run the applicable existing source/contracts checks.
- Verify the changed route, empty/loading/error/success states and keyboard/touch interaction.
- Check readable contrast, focus visibility, content overflow and relevant viewport sizes.
- For style switching, test each style alone before combinations; test combinations in the actual CSS load order and assert no console errors, missing tokens, overlapping controls, clipped dialogs, inaccessible contrast or broken interactions.

### R2 — identity, social, messaging, notifications, LIVE state, roles, or user data

- Run top-level and backend tests that cover the changed contract.
- Test both allowed and denied actors (owner, non-owner, logged-out, blocked or muted actor, moderator/admin if relevant).
- Test stale/expired session, duplicate submission, timeout/retry, disconnected/reconnected state, and refresh/reload persistence where applicable.
- Verify on target browser(s) and Android WebView/physical device when the affected capability uses device media or notifications.
- Check server logs for accurate, redacted failure context.

### R3 — money, gifts, payments, auth, RLS, schema, signing, or production incidents

- All R2 gates plus an explicit threat/data-integrity review.
- Validate idempotency, concurrency, duplicate webhooks/retries, authorization bypass attempts, transaction rollback behavior, and ledger totals.
- Reconcile current database schema and migration ledger; verify backup/restore readiness before any production schema mutation.
- Use sandbox or disposable accounts. Never fabricate or reset real balances as test setup.
- Keep production execution blocked until the owner explicitly approves the target, exact operation, timing, and rollback/compensation plan.
- Verify real integrations separately and state unavailable checks as BLOCKED/NOT RUN.

## Evidence record

For each run, record:

```text
Commit/package tested:
Environment and target:
Command or manual scenario:
Expected result:
Observed result:
Status: PASS | FAIL | BLOCKED | NOT RUN
Evidence location (redacted):
Notes/blocker and next action:
```

A screenshot is supplementary evidence, not a substitute for checking persistence, authorization, console/network errors, or server results. Redact user identities and never capture credentials or payment secrets.

## Release status terminology

- **PASS:** run completed and acceptance criteria were observed.
- **FAIL:** the check ran and did not meet expectations.
- **BLOCKED:** a required dependency, permission, environment, or device was unavailable.
- **NOT RUN:** no attempt was made.

Never turn BLOCKED or NOT RUN into PASS just because static tests are green.
