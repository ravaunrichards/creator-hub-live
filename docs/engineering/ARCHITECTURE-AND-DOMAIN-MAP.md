# CHL architecture and domain map

## Current high-level shape

The existing project documentation describes this service boundary:

```text
Web / PWA / Android WebView
          ↓ HTTPS/API
     Node.js backend
          ↓
       Supabase

LIVE media/control plane → LiveKit
Payments → PayPal → backend verification → wallet/transaction ledger
```

This diagram is a working map, not proof that each production integration is currently healthy. Verify runtime configuration and deployed health before making operational claims.

## Domain ownership

| Domain | Authoritative layer | Review focus |
|---|---|---|
| Identity/session | Auth provider plus backend authorization | Session expiry, account ownership, role checks, sensitive actions |
| Social graph/content | Existing relational records and RLS/backend checks | Privacy, block/mute, visibility, pagination, deletion/retention |
| Messaging/notifications | Persisted conversation/member/message/event records | Membership and sender/recipient authorization; delivery failure; user preferences |
| LIVE sessions/guests | Backend/session records plus LiveKit media state | State transitions, stale sessions, host authority, guest requests, reconnect and teardown |
| Gifts/wallets/diamonds/payouts | Database/server transaction and ledger functions | Idempotency, auditability, exact pricing, reversal handling, race conditions |
| Leagues/teams/rankings | Existing league/team records and calculation rules | Active season, reproducible standings, timezone reset, no direct purchase of rank |
| Appearance/theme | Existing settings and source stylesheet/runtime behavior | Per-user persistence, style collisions, contrast, responsive layout |
| Android wrapper | Android WebView/build/signing configuration | Web asset parity, origin rules, signing certificate continuity, real-device media permissions |
| Operations | Render and connected providers, verified in their dashboards | Runtime health, configuration, logs, deployment identity and rollback |

## Source-of-truth hierarchy

1. **Observed production behavior and live schema** establish current runtime state, but must be inspected read-only first and with least privilege.
2. **Repository source and committed migration history** explain intended code/schema changes; they do not guarantee the deployed service has those changes.
3. **Tests and manifests** state expected contracts and asset relationships; a passing static check is not a production integration test.
4. **Documentation** explains the state and process. Update it when evidence changes; never use an old doc to override a directly verified runtime fact.

For database work, the repository migration directory and live Supabase ledger must be reconciled before applying anything. This repository has previously documented migration-order/naming inconsistencies; never infer “not applied” from a filename alone.

## Change-boundary rules

- The frontend may display a balance or status; it must not independently mint, settle, or authorize it.
- The backend must re-check important authorization and validate all client-provided IDs, roles, prices, and state transitions.
- Database RLS is an additional enforcement layer, not a substitute for correct backend logic. Review policies and `SECURITY DEFINER` functions individually.
- LiveKit media connectivity and the app's persisted room lifecycle are related but distinct. A stale DB session or a successful token response alone is not proof that media is connected.
- Android WebView behavior should be tested separately from desktop browser behavior.
- External services require their own verified health and configuration; a mocked test should be labeled as mocked.

## When architecture must be documented

Create or update an ADR for cross-domain data ownership, new external services, auth/authorization model changes, new persistent event/state models, migration ordering, new monetization flows, significant realtime behavior, or irreversible data retention decisions. Small local fixes may be documented in the PR and relevant domain page instead.
