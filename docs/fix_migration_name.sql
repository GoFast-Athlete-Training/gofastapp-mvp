-- Run this once on the gofastapp-mvp DB (e.g. Neon SQL Editor) to fix the
-- migration history mismatch. Then run: npx prisma migrate deploy
--
-- Renames two applied migrations that used unexpanded $(date...) folder names
-- so they match the local migration folders.

UPDATE "_prisma_migrations"
SET migration_name = '20260117071251_remove_training_plan_days_add_workout_model'
WHERE migration_name = '$(date +%Y%m%d%H%M%S)_remove_training_plan_days_add_workout_model';

UPDATE "_prisma_migrations"
SET migration_name = '20260128230016_delete_test_run'
WHERE migration_name = '$(date +%Y%m%d%H%M%S)_delete_test_run';
