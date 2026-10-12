# Uploaded source and audit references

This release was prepared against the existing repository source and relevant uploaded project references. It does not blindly overlay files from unrelated historical bundles because several uploads contain different layouts or older revisions of the same application.

## Consolidated into this release

- Existing `creator-hub-live` source tree: retained as the canonical project layout; updates are integrated into the existing `frontend/`, `backend/`, `database/`, `scripts/`, `tests/` and `docs/` structure.
- The previously supplied Teams backend update material: its relevant team API/schema intent is consolidated with the repository's existing `0015_teams_backend_complete.sql`, the official division catalog, the `0017` compatibility repair, and the new forward-only `0018` convergence migration. Do not apply older package copies on top of this release without checking migration state.
- The broad Supabase read-only audit SQL: available as `database/diagnostics/full_supabase_inventory_audit.sql`. Run it only against the intended Supabase project; it inventories catalog metadata and does not write application data.
- The user-reported errors from 12 October 2026: included in `ERROR-RECOVERY-2026-10-12.md`, along with the associated Teams, active-season, PayPal environment, league administration and payout checks.

## Historical bundles and scope boundary

Some uploaded archives contain earlier or structurally different monolithic frontends, historical release contents, or files that are not part of the canonical repository layout. They were not indiscriminately overlaid because duplicate route systems, different schemas or private signing material could break the existing project or expose credentials. The present release implements and validates features against the canonical repository's actual modules and API contracts. Any additional legacy-only course/catalog or other standalone module must be explicitly ported into the current route/API architecture and independently tested; its presence in a historical ZIP is not evidence that it is integrated into this website.

## Source safety

This is a manual-install bundle. It does not alter GitHub, Supabase or a hosting provider. Preserve your local environment files and custom uncommitted changes before replacing source files. The release includes no real provider secrets.
