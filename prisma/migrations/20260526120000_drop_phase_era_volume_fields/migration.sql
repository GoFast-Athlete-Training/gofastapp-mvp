-- Backfill cyclePeakPool from legacy columns, then drop phase-era fields.
-- Peak pool: prefer existing cyclePeakPool; else approximate from old peak long run (×4 weeks' worth of a typical block total).

UPDATE "preset_volume_constraints"
SET
  "cyclePeakPool" = COALESCE(
    "cyclePeakPool",
    ("peakLongRunMiles"::float * 4.0)
  )
WHERE
  "cyclePeakPool" IS NULL;

-- Fallback if any row still has null (should not happen on valid data)
UPDATE "preset_volume_constraints"
SET "cyclePeakPool" = 88.0
WHERE "cyclePeakPool" IS NULL;

-- Alter to NOT NULL
ALTER TABLE "preset_volume_constraints" ALTER COLUMN "cyclePeakPool" SET NOT NULL;

-- Drop removed columns
ALTER TABLE "preset_volume_constraints" DROP COLUMN "taperWeeks";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "peakWeeks";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "taperLongRuns";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "baseStartMiles";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "cycleStep";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "peakEntryMiles";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "peakLongRunMiles";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "taperMileageReduction";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "cutbackFraction";
