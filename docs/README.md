# Creator Hub Live documentation

This directory holds product, engineering, operations, database, release, and validation documentation for **Creator Hub Live (CHL)**. Start with the engineering handbook for the standard way work is proposed, built, tested, released, and supported.

## Start here

- [Engineering handbook](engineering/README.md) — the canonical map and operating model.
- [Feature delivery workflow](engineering/WORKFLOW.md) — from intake through release evidence.
- [Architecture and domain map](engineering/ARCHITECTURE-AND-DOMAIN-MAP.md) — current boundaries and sources of truth.
- [Quality gates](engineering/QUALITY-GATES.md) — existing commands and required manual acceptance.
- [Database change control](engineering/DATA-CHANGE-CONTROL.md) — safe schema/migration process.
- [Release and rollback](engineering/RELEASE-AND-ROLLBACK.md) — deployment readiness and recovery.
- [Security, privacy, and observability](engineering/SECURITY-PRIVACY-OBSERVABILITY.md).
- [Incident response](engineering/INCIDENT-RESPONSE.md).
- [Platform-pattern catalog](engineering/PLATFORM-PATTERNS.md) — lessons to evaluate from social, messaging, and live platforms without cloning them.

## Existing project references

Use these existing documents for implementation-specific detail. They are not replaced by this handbook:

- [API notes](API.md)
- [Database notes](DATABASE.md)
- [Deployment notes](DEPLOYMENT.md)
- [Security notes](SECURITY.md)
- [LIVE setup](LIVE-SETUP.md)
- [Release history](RELEASES.md)
- [Production acceptance checklist](PRODUCTION-ACCEPTANCE-CHECKLIST.md)

## Documentation contract

Documentation records what is known, what is proposed, and what was actually verified. Do not rewrite historical test reports to make an old result appear current. New evidence should include the commit or package tested, exact command/device/environment, result, and any limitations. If live services were not reached, state that clearly.
