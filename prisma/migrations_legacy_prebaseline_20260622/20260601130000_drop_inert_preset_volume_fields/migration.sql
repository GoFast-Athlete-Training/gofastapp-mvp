-- Remove volume fields that were not consumed by plan generation and duplicated run-type / cycle-pool concerns.

ALTER TABLE "preset_volume_constraints"
  DROP COLUMN IF EXISTS "cutbackWeekModulo",
  DROP COLUMN IF EXISTS "weeklyMileageMultiplier",
  DROP COLUMN IF EXISTS "longRunCapFraction",
  DROP COLUMN IF EXISTS "minEasyWeekMiles";
