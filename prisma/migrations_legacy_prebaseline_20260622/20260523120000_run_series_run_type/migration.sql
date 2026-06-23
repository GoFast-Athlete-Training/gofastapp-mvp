-- AlterTable
ALTER TABLE "run_series" ADD COLUMN "runType" TEXT;

-- Backfill track workouts previously encoded in seriesRunRawText
UPDATE "run_series"
SET "runType" = 'track'
WHERE "runType" IS NULL
  AND (
    "seriesRunRawText" LIKE '% · track · %'
    OR "seriesRunRawText" LIKE '% · track'
    OR "seriesRunRawText" = 'track'
  );
