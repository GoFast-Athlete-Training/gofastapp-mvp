-- Activity-to-segment execution: link segment laps to source activity; track alignment status on workout.

ALTER TABLE "workout_segment_laps" ADD COLUMN IF NOT EXISTS "activityId" TEXT;

-- Backfill activityId from matched workout when possible
UPDATE "workout_segment_laps" wsl
SET "activityId" = w."matchedActivityId"
FROM "workout_segments" ws
JOIN "workouts" w ON w.id = ws."workoutId"
WHERE wsl."segmentId" = ws.id
  AND wsl."activityId" IS NULL
  AND w."matchedActivityId" IS NOT NULL;

DELETE FROM "workout_segment_laps" WHERE "activityId" IS NULL;

ALTER TABLE "workout_segment_laps" ALTER COLUMN "activityId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "workout_segment_laps_activityId_lapIndex_key"
  ON "workout_segment_laps"("activityId", "lapIndex");
CREATE INDEX IF NOT EXISTS "workout_segment_laps_activityId_idx"
  ON "workout_segment_laps"("activityId");

DO $$ BEGIN
  ALTER TABLE "workout_segment_laps" ADD CONSTRAINT "workout_segment_laps_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "athlete_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "segmentExecutionStatus" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "segmentExecutionLapCount" INTEGER;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "segmentExecutionSegmentCount" INTEGER;
