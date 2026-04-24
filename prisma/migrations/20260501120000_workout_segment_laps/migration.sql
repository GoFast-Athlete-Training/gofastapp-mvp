-- One row per Garmin lap window (time boundaries from detailData.laps + derived stats from samples).
-- Idempotent: safe if table was created earlier via manual DDL.
CREATE TABLE IF NOT EXISTS "workout_segment_laps" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "lapIndex" INTEGER NOT NULL,
    "startTimeInSeconds" INTEGER NOT NULL,
    "endTimeInSeconds" INTEGER NOT NULL,
    "avgPaceSecPerMile" INTEGER,
    "avgHeartRate" INTEGER,
    "distanceMiles" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_segment_laps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workout_segment_laps_segmentId_lapIndex_key" ON "workout_segment_laps"("segmentId", "lapIndex");
CREATE INDEX IF NOT EXISTS "workout_segment_laps_segmentId_idx" ON "workout_segment_laps"("segmentId");

DO $$ BEGIN
    ALTER TABLE "workout_segment_laps" ADD CONSTRAINT "workout_segment_laps_segmentId_fkey"
        FOREIGN KEY ("segmentId") REFERENCES "workout_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
