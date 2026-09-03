-- Garmin lap rows exist on this workout instance (workout_segment_laps).
ALTER TABLE "workouts" ADD COLUMN "splitsStamped" BOOLEAN NOT NULL DEFAULT false;
