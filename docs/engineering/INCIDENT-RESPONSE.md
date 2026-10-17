# Incident response and post-incident learning

## Severity guide

| Level | Typical impact | Initial posture |
|---|---|---|
| SEV-1 | Suspected account compromise, exposed secret, unauthorized financial mutation, broad service outage, major privacy leak | Contain immediately; notify project owner; preserve audit evidence; pause risky changes/actions as authorized |
| SEV-2 | Core capability materially degraded for many users (login, LIVE start/join, messaging, paid purchase/payout) | Assign an incident lead; scope affected paths; prioritize mitigation and status updates |
| SEV-3 | Limited feature degradation with workaround and no known sensitive-data/financial impact | Track owner and ETA; use normal repair workflow with evidence |
| SEV-4 | Cosmetic issue, docs issue, isolated low-impact defect | Queue and prioritize; no incident command unless impact escalates |

Severity is based on user/data impact, not how easy the code fix appears. Escalate if financial integrity, privacy, authorization or active exploitation is plausible.

## Response sequence

1. **Detect and declare.** Record start time, reporter, affected service/route, impact, severity, current evidence and unknowns.
2. **Assign roles.** One incident lead coordinates; one investigator gathers technical evidence; one communicator prepares updates. For a solo response, state that roles are combined.
3. **Stabilize and contain.** Prefer reversible mitigations. Do not make unreviewed production SQL edits, disable authorization broadly, wipe active LIVE data, or change wallet balances as a shortcut.
4. **Diagnose.** Correlate frontend/backend/provider events with a request/correlation ID and timestamps. Compare last known good deployment/configuration, error rate, auth failures, provider health and state-transition logs.
5. **Recover.** Apply the lowest-risk verified fix or rollback; run health and affected user-flow checks.
6. **Communicate.** Give concise updates about impact, workaround, data/financial integrity, and what is not yet known. Avoid exposing personal information or secrets.
7. **Observe.** Confirm error rates and affected user journeys return to acceptable levels; watch for recurrence.
8. **Close and learn.** Complete a blameless review and track corrective actions by owner and due date.

## CHL-specific response checks

- **Auth/session:** identify affected routes and users; rotate/revoke compromised credentials as appropriate; do not publish tokens or session IDs.
- **LIVE/LiveKit:** separate backend API health, token authorization, room state, presence and media-track connection; check host/guest controls, stale sessions and ended-room discovery.
- **Payments/wallet/gifts:** stop duplicate processing if necessary, preserve provider event IDs and ledger evidence, check idempotency and reconciliations; never “fix” a discrepancy by manually setting a balance.
- **Supabase/RLS:** identify exact table, policy, function and actor role; use read-only inspection first and preserve an audit trail for approved changes.
- **Android/WebView:** capture app/web build identity, device/OS, WebView origin and network errors; distinguish wrapper defects from backend/provider failure.

## Blameless postmortem structure

Use `templates/INCIDENT-POSTMORTEM.md`. Focus on how system design, missing alerts, confusing state, unsafe defaults, or process gaps allowed or extended the incident. Include what detected it, what reduced impact, what delayed recovery, and how corrective actions will be validated. Avoid stopping at “developer forgot” or “user error.”

## Reference

- [Google SRE — Incident Management Guide](https://sre.google/resources/practices-and-processes/incident-management-guide/)
