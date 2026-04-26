-- Drop dead pyramid/ladder workout metadata from workout_catalogue
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "isLadder";
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "ladderStepMeters";
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "minLadderMeters";
ALTER TABLE "workout_catalogue" DROP COLUMN IF EXISTS "maxLadderMeters";

-- Rename plan-frozen cycle position on workouts (Intervals/Tempo long-run MP uses same 0–3 slot)
ALTER TABLE "workouts" RENAME COLUMN "planLadderIndex" TO "planCycleIndex";

-- Rename preset long-run distance-step fields (cycle language, not "ladder")
ALTER TABLE "preset_volume_constraints" RENAME COLUMN "ladderStep" TO "cycleStep";
ALTER TABLE "preset_volume_constraints" RENAME COLUMN "ladderCycleLen" TO "cycleLen";
