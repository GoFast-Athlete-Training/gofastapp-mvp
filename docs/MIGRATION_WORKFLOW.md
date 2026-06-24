# Migration workflow (gofastapp-mvp)

## Active vs archive

| Path | Purpose |
|------|---------|
| `prisma/migrations/` | **Active** — only folder Prisma CLI should use |
| `prisma/migrations_legacy_prebaseline_20260622/` | **Archive only** — historical SQL; never run via CLI |

The current schema was baselined in `00000000000000_baseline`. Older incremental migrations live in the archive folder for reference only.

## Environment

Prisma needs both:

- `DATABASE_URL` — pooled Neon URL (runtime / app)
- `DATABASE_URL_UNPOOLED` — direct Neon URL (`directUrl` in `schema.prisma`; required for migrate)

Load from `.env` and `.env.local`. Prefer npm scripts (they use `scripts/with-env-local.mjs`) instead of bare `npx prisma …`.

## Safe commands (shared / dev / CI / production)

```bash
cd gofastapp-mvp

# 1. Check for blocking failed rows in _prisma_migrations
npm run prisma:health

# 2. See pending vs applied
npm run prisma:status

# 3. Apply pending migrations (no reset, no dev prompts)
npm run prisma:migrate
```

`npm run build` already runs `migrate deploy` before `next build`.

## When **not** to use `migrate dev`

`prisma migrate dev` is for **local disposable databases** where a reset is acceptable.

On shared Neon dev/prod DBs it may:

- Detect history drift vs an old branch or archive folder
- Prompt for **`migrate reset`** (drops all data)

Use `prisma:health` + `prisma:migrate` instead.

## Known legacy drift: `20241214220000_add_planning_days_to_weeks`

This migration lived in the pre-baseline archive. It tried to alter `training_plan_weeks`, which no longer exists.

If `_prisma_migrations` contains this row with:

- `finished_at` = null
- `rolled_back_at` set
- `applied_steps_count` = 0

…then `npm run prisma:health` treats it as **safe** and `migrate deploy` continues normally.

**Do not** `migrate resolve --applied` for this migration — its target table is gone.

**Do not** copy this folder back into `prisma/migrations/`.

## Fixing real failed migrations

If `prisma:health` reports an unresolved failed migration:

1. Inspect logs in `_prisma_migrations` for that row.
2. Either fix the schema/SQL and re-run deploy, or manually apply the SQL and mark resolved:

   ```bash
   node scripts/with-env-local.mjs prisma migrate resolve --applied "MIGRATION_NAME"
   ```

3. Re-run `npm run prisma:health` and `npm run prisma:migrate`.

For historical name mismatches (malformed `$(date…)` folder names), see [MIGRATION_HISTORY_MISMATCH_FIX.md](./MIGRATION_HISTORY_MISMATCH_FIX.md).

## Creating new migrations

1. Edit `prisma/schema.prisma`.
2. On a **throwaway local DB** (or after backing up): `node scripts/with-env-local.mjs prisma migrate dev --name descriptive_name --schema=./prisma/schema.prisma`
3. Commit the new folder under `prisma/migrations/`.
4. On shared environments: `npm run prisma:migrate` only.

Never use `prisma db push --accept-data-loss` on shared databases (see GoFast Company rules).
