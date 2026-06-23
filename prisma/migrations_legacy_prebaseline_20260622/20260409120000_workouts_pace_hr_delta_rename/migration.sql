-- Rename pace / target columns; drop redundant direction string; add HR delta.
ALTER TABLE "workouts" RENAME COLUMN "derivedPerformanceDeltaSeconds" TO "paceDeltaSecPerMile";
ALTER TABLE "workouts" RENAME COLUMN "derivedAgainstTargetPace" TO "targetPaceSecPerMile";
ALTER TABLE "workouts" DROP COLUMN "derivedPerformanceDirection";
ALTER TABLE "workouts" ADD COLUMN "hrDeltaBpm" INTEGER;
