-- Drop legacy plan-generate and unused pace-log "quality" columns.
-- Backfill preferredQualityDays into split tempo/interval DOWs before drop.

UPDATE "training_plans"
SET
  "preferredTempoDow" = COALESCE(
    "preferredTempoDow",
    CASE
      WHEN cardinality("preferredQualityDays") >= 1 THEN "preferredQualityDays"[1]
      ELSE NULL
    END
  ),
  "preferredIntervalDow" = COALESCE(
    "preferredIntervalDow",
    CASE
      WHEN cardinality("preferredQualityDays") >= 2 THEN "preferredQualityDays"[2]
      ELSE NULL
    END
  )
WHERE cardinality("preferredQualityDays") > 0;

ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "preferredQualityDays";

ALTER TABLE "pace_adjustment_log" DROP COLUMN IF EXISTS "qualityWorkoutsCount";
ALTER TABLE "pace_adjustment_log" DROP COLUMN IF EXISTS "qualityAvgDeltaSecPerMile";
