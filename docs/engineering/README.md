# CHL engineering handbook

## Purpose

Give Creator Hub Live one repeatable engineering operating system: a feature is not finished merely because code was written, a deployment is not verified merely because a build passed, and an existing database is not safe to change merely because a migration file exists.

## How to use this handbook

1. Start every change with [the workflow](WORKFLOW.md).
2. Establish the real behavior and source of truth using [the architecture map](ARCHITECTURE-AND-DOMAIN-MAP.md).
3. Select the risk level and evidence in [quality gates](QUALITY-GATES.md).
4. For schema changes, follow [database change control](DATA-CHANGE-CONTROL.md) before execution.
5. Before shipping, complete [release readiness and rollback](RELEASE-AND-ROLLBACK.md).
6. During outages, use [incident response](INCIDENT-RESPONSE.md).
7. Use [security/privacy/observability rules](SECURITY-PRIVACY-OBSERVABILITY.md) throughout, not only at release time.
8. When borrowing ideas from other social or livestream products, use [the platform-pattern catalog](PLATFORM-PATTERNS.md) as a discovery framework, not as approval to build every feature.

## Operating principles

- **Inspect before editing.** Read the current source, routes, data model, tests, and user-visible behavior first.
- **One coordinated change set.** Group fixes only when they share one root cause or acceptance goal; avoid unrelated rewrites.
- **Preserve working behavior.** Add contract tests before changing sensitive paths and retain a reversible backup/commit.
- **The server enforces truth.** The browser may request an action; it does not decide entitlement, payment settlement, balances, moderation authority, or access rights.
- **No fake success.** Never substitute demo records or client-side counters for real persisted behavior.
- **Test the path users take.** Verify affected routes and states on mobile, desktop, and Android WebView where applicable.
- **Evidence beats confidence.** Record PASS/FAIL/BLOCKED/NOT RUN with results, not adjectives such as “fully fixed” without proof.
- **No silent production mutation.** Production database or deployment actions require explicit approval, a backup/rollback plan, and a target verification step.

## Risk classes

| Class | Examples | Minimum control |
|---|---|---|
| R0 — docs-only | Markdown, internal instructions | Link/format validator; review for accuracy |
| R1 — low product risk | Copy, spacing, isolated presentational UI | Existing checks; affected-route/responsive smoke test; accessibility review |
| R2 — user-data or realtime behavior | Profile, messages, notifications, guest requests, permissions, LIVE status | Contract/unit tests; authorization tests; failure-path tests; mobile/browser verification |
| R3 — critical | Wallet/coins/diamonds, gifts/settlement, PayPal, auth/session, RLS, schema, signing identity, production incident fixes | R2 gates plus data/security review, idempotency/rollback plan, staging or disposable test-account evidence, explicit approval before production execution |

Raise the class when a change crosses a higher-risk boundary. A tiny code diff can still be R3.

## Ownership and status language

CHL's owner chooses product priorities and authorizes production actions. A change author is responsible for evidence and rollback notes. Reviewers challenge assumptions and check impacts outside the changed file. Where there is no separate reviewer available, use the written checklist and state that independent review was unavailable rather than pretending there was one.

Use only these evidence states: **PASS**, **FAIL**, **BLOCKED**, **NOT RUN**. A blocked check needs a cause and the next required action. Record confirmed facts separately from hypotheses.
