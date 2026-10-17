# CHL release readiness record

- **Version / commit / artifact hash:**
- **Target environment and services:**
- **Risk class:** R0 / R1 / R2 / R3
- **Owner / approval:**

## Scope
Added/replaced/removed files, user-visible changes, schema/API contracts, dependencies, known exclusions.

## Evidence
| Check/scenario | Command/device/environment | Status (PASS/FAIL/BLOCKED/NOT RUN) | Result/evidence |
|---|---|---|---|
| Existing top-level checks | `npm run check` |  |  |
| Backend check | `npm run backend:check` |  |  |
| Backend tests | `npm run backend:test` |  |  |
| Targeted integration/manual test |  |  |  |

## Data/security
Migration ledger reconciled? Backup/restore path? RLS/authorization verified? Secrets redacted? Idempotency and audit logs verified?

## Operations
Health/smoke checks, dashboards/logs, observation window, failure thresholds, recovery/compensation plan, release notes.

## Final decision
Ready / Hold / Roll back. Explain each failed, blocked, or not-run required check. Never use this template to imply a check ran when it did not.
