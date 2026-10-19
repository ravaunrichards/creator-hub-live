# Architecture Decision Records (ADRs)

ADRs record durable decisions and why alternatives were accepted or rejected. Use the template at `../templates/ADR.md`.

- One decision per record; give it a stable sequential ID.
- Use `Proposed` until the owner/reviewer accepts it. Do not imply approval that did not occur.
- Accepted records are immutable in intent; supersede an old decision with a new ADR rather than silently rewriting history.
- Include consequences, rollout/migration needs, security/data ownership impacts, and how the decision can be revisited.

Suggested trigger points: new external provider, cross-domain source of truth, new real-time lifecycle/state model, changes to payment or gift settlement, migration strategy, identity/privacy semantics, or major deployment/recovery architecture.
