-- RenameTable
ALTER TABLE "run_manager_grants" RENAME TO "run_manager_access";

-- Drop legacy product role rows (authorization is run_manager_access only)
DELETE FROM "athlete_product_roles" WHERE "role" = 'RUN_MANAGER';
