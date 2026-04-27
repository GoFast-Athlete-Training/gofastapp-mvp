-- Plan preset volume/workout no longer store long-run / easy floor or quality-slot count; generator uses
-- merge defaults in `generate-plan-from-configs.ts` instead.
ALTER TABLE "preset_volume_constraints" DROP COLUMN IF EXISTS "minLongMiles";
ALTER TABLE "preset_volume_constraints" DROP COLUMN IF EXISTS "minEasyPerDayMiles";
ALTER TABLE "preset_workout_config" DROP COLUMN IF EXISTS "qualitySessions";
