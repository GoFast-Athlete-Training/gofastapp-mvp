-- Branded shakeout registration (optional; null required = unknown).

ALTER TABLE "city_runs" ADD COLUMN "registrationRequired" BOOLEAN;
ALTER TABLE "city_runs" ADD COLUMN "registrationUrl" TEXT;
