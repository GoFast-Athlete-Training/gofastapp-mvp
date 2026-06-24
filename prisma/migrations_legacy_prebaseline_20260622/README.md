# Archive only — do not use with Prisma CLI

This folder preserves **pre-baseline** migration SQL from before `00000000000000_baseline`.
It is **not** the active migration directory.

**Active migrations:** `prisma/migrations/`

Do **not** point `prisma migrate dev`, `migrate deploy`, or `--migrations-folder` at this directory.
Some migrations here target tables that no longer exist (e.g. `training_plan_weeks`).

For safe workflows see [docs/MIGRATION_WORKFLOW.md](../../docs/MIGRATION_WORKFLOW.md).
