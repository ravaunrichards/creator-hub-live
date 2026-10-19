# Creator Hub Live — Documentation & Workflow System

Additive manual-install package. It does not edit GitHub, Supabase, Render, application code, or production.

1. Back up existing `docs/`, `scripts/`, and `.github/workflows/` paths.
2. Merge these files into the repository root; do not replace existing folders wholesale.
3. Review `docs/README.md` and compare project facts with current source/configuration.
4. Run `node scripts/check-docs.mjs`.
5. Review the proposed GitHub Actions workflow before enabling it.

A generated ZIP is not installed, deployed, or production-verified. This package does not prove application behavior.
