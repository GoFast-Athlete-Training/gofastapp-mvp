-- workouts.stravaUrl exists in Prisma schema but was never migrated; Prisma create/select fails without it.
DO $$ BEGIN
  ALTER TABLE "workouts" ADD COLUMN "stravaUrl" TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
