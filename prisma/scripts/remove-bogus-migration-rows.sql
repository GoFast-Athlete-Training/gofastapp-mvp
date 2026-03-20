-- Remove _prisma_migrations rows that have bad names (literal $(date...) from a broken deploy)
DELETE FROM "_prisma_migrations"
WHERE "migration_name" LIKE '$(date%';
