# Migration history mismatch fix (gofastapp-mvp)

## What’s wrong

`prisma migrate deploy` fails because the DB’s migration history doesn’t match the repo:

- **In DB but not found locally:**  
  - `$(date +%Y%m%d%H%M%S)_remove_training_plan_days_add_workout_model`  
  - `$(date +%Y%m%d%H%M%S)_delete_test_run`  
  Those names were created by using an unexpanded shell command as the migration folder name. The same migrations exist locally as `20260117071251_remove_training_plan_days_add_workout_model` and `20260128230016_delete_test_run`.

- **Last common migration:** `20260124131250_add_address_fields_to_city_runs`

- **Pending (not yet applied):**  
  `20260124131255_add_address_fields_to_city_runs`, `20260128223624_add_runclub_id_fk`, `20260201_add_run_type_enum`, `20260215000000_add_run_workflow_status`  
  The first two are empty migration folders (no `migration.sql`) and have been removed from the repo to avoid no-op pending migrations.

## Fix (align DB with repo, then deploy)

### 1. Update the migration name in the DB

Run the script **docs/fix_migration_name.sql** on your **gofastapp-mvp** database (e.g. in Neon SQL Editor or `psql`). It updates the applied migration name so it matches the local folder `20260117071251_remove_training_plan_days_add_workout_model` (same SQL, correct name).

### 2. Deploy remaining migrations

From the app repo:

```bash
cd /path/to/gofastapp-mvp
npx prisma migrate deploy
```

This will apply only the pending migrations that have SQL (e.g. `20260201_add_run_type_enum`, `20260215000000_add_run_workflow_status`).

## Optional: apply the new migration by hand

If you prefer not to fix the history and only want the run workflow status changes:

1. Run the SQL from  
   `prisma/migrations/20260215000000_add_run_workflow_status/migration.sql`  
   on the DB (create enum `RunWorkflowStatus`, add `workflowStatus` to `city_runs`, create index).

2. Mark that migration as applied so Prisma doesn’t run it again:

   ```bash
   npx prisma migrate resolve --applied "20260215000000_add_run_workflow_status"
   ```

The recommended approach is still to fix the history with the `UPDATE` above and then run `prisma migrate deploy`, so future migrations apply in order and the history stays consistent.

## Repo clean-up done

- Removed empty migration folders that had no `migration.sql`:  
  `20260124131255_add_address_fields_to_city_runs`, `20260128223624_add_runclub_id_fk`
- Removed the malformed folder `$(date +%Y%m%d%H%M%S)_delete_test_run` (the same migration exists as `20260128230016_delete_test_run`). The fix script renames this applied migration in the DB so history matches.
