-- Remove persisted buildCoef; cycle-pool derives per-cycle growth from base/peak at runtime using total weeks.
ALTER TABLE "preset_volume_constraints" DROP COLUMN IF EXISTS "buildCoef";
