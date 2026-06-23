-- Coach-managed workout catalogue + optional FK on workouts
CREATE TABLE IF NOT EXISTS "workout_catalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workoutType" "WorkoutType" NOT NULL,
    "intendedPhase" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "progressionIndex" INTEGER NOT NULL,
    "reps" INTEGER,
    "repDistanceMeters" INTEGER,
    "recoveryDistanceMeters" INTEGER,
    "warmupMiles" DOUBLE PRECISION,
    "cooldownMiles" DOUBLE PRECISION,
    "repPaceOffsetSecPerMile" INTEGER,
    "recoveryPaceOffsetSecPerMile" INTEGER,
    "overallPaceOffsetSecPerMile" INTEGER,
    "intendedHeartRateZone" TEXT,
    "intendedHRBpmLow" INTEGER,
    "intendedHRBpmHigh" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_catalogue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workout_catalogue_name_workoutType_key"
    ON "workout_catalogue"("name", "workoutType");
CREATE INDEX IF NOT EXISTS "workout_catalogue_workoutType_progressionIndex_idx"
    ON "workout_catalogue"("workoutType", "progressionIndex");

ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "catalogueWorkoutId" TEXT;

CREATE INDEX IF NOT EXISTS "workouts_catalogueWorkoutId_idx" ON "workouts"("catalogueWorkoutId");

DO $$ BEGIN
    ALTER TABLE "workouts" ADD CONSTRAINT "workouts_catalogueWorkoutId_fkey"
        FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
