# Creator Hub Live — Documentation & Workflow System

**Package type:** additive documentation/workflow upgrade with one documentation-index replacement.  
**Target repository:** `ravaunrichards/creator-hub-live`, branch `main` (audited read-only).  
**Remote changes made:** none. This package does not edit GitHub, Supabase, Render, secrets, or the live CHL site.

## What this package changes

- Replaces `docs/README.md`, which currently describes a standalone CSS style lab rather than the repository's full documentation library.
- Adds a structured `docs/engineering/` handbook for feature delivery, platform-pattern evaluation, architecture, test gates, database change control, release/rollback, security/observability, and incident response.
- Adds feature, bug, technical design, decision record, release-readiness, and incident postmortem templates.
- Adds GitHub issue and pull-request templates.
- Adds a small no-dependency Node.js documentation validator and a GitHub Actions workflow to run it on relevant pull requests and main-branch changes.

It does **not** add social network integrations, new product features, database migrations, secrets, or deployment automation.

## Manual installation

1. Download and inspect this ZIP before copying anything.
2. Back up the repository or create a local Git commit first.
3. Extract at the repository root, preserving the included folder paths.
4. Review the one replacement carefully: `docs/README.md`. It is intended to become the central documentation index. The current version is a CSS Style Lab readme and is not a general CHL documentation index. Keep a copy elsewhere first if you still rely on that standalone guide.
5. Copy the new folders/files into the existing repository. Do not replace `package.json`, application code, migrations, `.env` files, signing material, or current backend/frontend files.
6. From the repository root, run:

   ```sh
   node scripts/validate-docs.mjs
   ```

7. Review the test result. Then run the existing project checks appropriate for your environment, including `npm run check`, `npm run backend:check`, and `npm run backend:test`. These are separate application checks; this package does not claim they passed.
8. Inspect the diff before committing. The new `.github/workflows/docs-quality.yml` will run the documentation validator on matching pull requests and pushes to `main`; it does not deploy CHL.

## File-scope manifest

| Destination | Operation | Purpose |
|---|---|---|
| `docs/README.md` | Replace existing | Main documentation index |
| `docs/engineering/**` | Add | Engineering handbook, templates, decision-record directory |
| `.github/PULL_REQUEST_TEMPLATE.md` | Add | Pull-request checklist |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Add | Structured bug intake |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Add | Structured feature intake |
| `.github/workflows/docs-quality.yml` | Add | Automated documentation checks only |
| `scripts/validate-docs.mjs` | Add | No-dependency docs/link validator |

## Safety rules

- No production change is authorized by installing the documents alone.
- Database work requires a live schema and migration-ledger reconciliation, backup, and an explicitly approved execution plan.
- Payments, coin balances, diamond balances, gift prices, gift settlement, LiveKit tokens, account permissions, and RLS policies are high-risk and must never be treated as frontend-only changes.
- Do not label a test as PASS unless it was run and evidence was recorded. Use **PASS**, **FAIL**, **BLOCKED**, or **NOT RUN** distinctly.
- Never put real passwords, access tokens, signing keys, service-role keys, webhook secrets, or private user data in reports, screenshots, issues, or logs.

## Evidence and limits

The package was built after a read-only inspection of the public `main` branch. The inspection found many existing docs in a flat `docs/` directory, an existing docs index focused on the CSS Style Lab, and one checked-in Actions workflow focused on Android debug builds. The package adds a docs-specific gate without replacing the Android workflow. Local validator/package tests will be described in the delivery message; this does not constitute live database, device, payment, streaming, or deployment testing.
