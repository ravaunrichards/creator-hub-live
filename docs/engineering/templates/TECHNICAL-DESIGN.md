# Technical design

## Summary and goal
What observable user or operational outcome changes?

## Current system audit
Relevant source paths, routes, tables/columns/constraints/functions/policies, consumers, existing tests, runtime observations and known unknowns.

## Proposed flow
Describe request → authorization → validation → persistent operation → response/event → UI state. Include sequence diagram only if it improves clarity.

## Contracts and state
API request/response/error shape; state transitions; idempotency key; timeout/retry behavior; compatibility with previous versions.

## Data change
Schema and migration number, constraints/indexes, backfill, RLS/policy and grants, data retention, live-ledger reconciliation, backup and post-check. Write “none” when none.

## Security and privacy
Actor/role matrix, abuse cases, validation, sensitive-data flow, log redaction, external-provider trust boundary.

## UX and accessibility
Loading, empty, success, error, offline/reconnect, keyboard/touch, responsive sizes, content overflow, contrast, reduced-motion behavior if relevant.

## Test plan
Existing contracts plus new regression tests; negative/permission tests; integration vs mocked tests; physical device/provider checks.

## Rollout and recovery
Dependency sequence, feature exposure, monitoring, rollback or compensation. Identify irreversible operations.

## Decision and unresolved questions
Alternatives considered, trade-offs, blockers, owner and approval status.
