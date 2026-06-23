-- Pre-computed mileage snapshot on Athlete (populated by cron, read by engagement endpoints)

ALTER TABLE "Athlete" ADD COLUMN "avgWeeklyMilesSnapshot" DOUBLE PRECISION;
ALTER TABLE "Athlete" ADD COLUMN "mileageSnapshotUpdatedAt" TIMESTAMP(3);
