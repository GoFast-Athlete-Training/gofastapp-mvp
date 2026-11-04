-- Week validate board: staff confirmation flags + instance-only route notes
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "routeNotes" TEXT;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "dateValidate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "timeValidate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "meetupValidate" BOOLEAN NOT NULL DEFAULT false;
