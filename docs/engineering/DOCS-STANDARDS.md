# Documentation standards

## Information architecture

Keep the root docs index short and stable. Place long-lived engineering guidance under `docs/engineering/`; keep domain-specific implementation instructions beside the existing API/database/LIVE/deployment documentation. Put dated build, audit, or QA evidence in a historical report with the tested commit/package and date. Do not create another competing “start here” document for the same audience.

Use the four documentation modes:

- **Tutorial:** a guided first successful task.
- **How-to:** steps for an actual task.
- **Reference:** exact commands, schemas, options and contracts.
- **Explanation:** context, trade-offs, architecture, and reasoning.

A page may mix modes, but label them clearly and avoid mixing a historical test result with normative instructions.

## Every operational guide should state

- purpose and intended reader;
- prerequisites/permissions/environment;
- exact steps and expected observations;
- failure handling and safe stop conditions;
- rollback/recovery path when changes are possible;
- last verification status/date when claims depend on runtime state;
- links to the relevant source code, schema, test or owner.

## Accuracy and change control

- Label observations, assumptions, proposals and verified results separately.
- Do not write “fixed”, “works”, “production-ready” or “all tests passed” unless the cited evidence supports that exact claim.
- Keep command names in sync with `package.json`, backend scripts and current CI files.
- Do not delete old test reports or rewrite previous outcomes; add a newer report.
- Do not put secrets or real customer data into docs.
- Update docs within the same change set if an API, schema contract, workflow, or release procedure changes.
- Prefer relative links for repository documents and test them automatically.

## Review checklist

- [ ] Correct audience and purpose are stated.
- [ ] Steps can be followed from a clean starting point.
- [ ] Required permissions and environment are clear.
- [ ] Commands are current and were checked against source/configuration.
- [ ] Risk, stop conditions, rollback and post-checks are explained.
- [ ] Links resolve.
- [ ] No secret, private information, unsupported claim, or stale version assertion is present.

## Reference

- [Diátaxis documentation framework](https://diataxis.fr/)
- [GitHub — Templates for useful issues and pull requests](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests)
