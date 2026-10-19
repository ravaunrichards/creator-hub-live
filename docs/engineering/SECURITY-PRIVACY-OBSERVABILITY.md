# Security, privacy, and observability standard

## Default security model

Treat browser/mobile clients, uploaded content, query parameters, client-supplied IDs/prices/roles, and external webhook payloads as untrusted. The backend must validate inputs and re-authorize sensitive actions. Database permissions and RLS should reinforce least privilege. Review each policy/function based on its intended actor and use case; do not add broad policies simply to remove an error.

## Review checklist

- Authentication and session expiry are tested, including revoked/expired sessions.
- Every sensitive route checks the correct user/resource relationship and role server-side.
- Block, mute, private-account, group-membership and recipient-preference rules are enforced where relevant, not only in the UI.
- File/media uploads have type/size limits, safe storage/access rules, and failure cleanup.
- `SECURITY DEFINER` functions have a reviewed owner, fixed/safe `search_path`, explicit authorization and execution grants.
- Secrets are held in approved environment/secret storage and scoped to least privilege. Rotation and revocation steps are documented.
- No real credentials, session identifiers, access/refresh tokens, private keys, payment secrets, or unnecessary personal data appear in logs, screenshots, PRs or test fixtures.
- Dependency and workflow permissions are limited to what the job requires. The docs-validation workflow needs read-only repository access and no production secrets.

## Observability contract

Useful logs should tell operators what failed without disclosing sensitive content. Prefer structured fields such as:

```json
{
  "timestamp": "ISO-8601 timestamp",
  "level": "error|warn|info",
  "service": "backend|frontend|live|payments",
  "event": "stable.event.name",
  "request_id": "non-secret correlation identifier",
  "actor_ref": "pseudonymous or internal reference where justified",
  "resource_type": "resource category",
  "outcome": "success|denied|failed",
  "error_code": "stable machine-readable code"
}
```

This is a suggested log shape, not a claim that all current services already emit it. Avoid logging message bodies, gift/payment payloads, tokens, card/payment secrets, or raw private profile data. Sanitize untrusted strings to prevent log injection. Restrict access and retention based on operational and legal needs.

Track service and product outcomes separately. Useful signals include request/error rate, latency, backend saturation, provider/LiveKit connection failures, room start/join success, stale/ended room count, payment verification failures, duplicate/idempotency conflicts, notification delivery failures, and migration verification failures. Set alert thresholds only after establishing normal baselines and ownership.

## Privacy by design

- Collect only data needed for the documented feature and operational/security purpose.
- Document visibility, retention, deletion/export behavior, and who can access each new data category.
- Avoid storing copies of sensitive data when an existing authoritative reference suffices.
- Use disposable test accounts for destructive account, subscription, gift, payment and messaging tests.
- For screenshots/reports, minimize identifying information and redact private content.

## Security source references

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
