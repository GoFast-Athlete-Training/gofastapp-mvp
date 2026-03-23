-- workout_segments was in Prisma schema but never migrated; nested create on workouts fails with P2021.
CREATE TABLE IF NOT EXISTS "workout_segments" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationType" TEXT NOT NULL,
    "durationValue" DOUBLE PRECISION NOT NULL,
    "targets" JSONB,
    "repeatCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workout_segments_workoutId_idx" ON "workout_segments"("workoutId");
CREATE INDEX IF NOT EXISTS "workout_segments_workoutId_stepOrder_idx" ON "workout_segments"("workoutId", "stepOrder");

DO $$ BEGIN
    ALTER TABLE "workout_segments" ADD CONSTRAINT "workout_segments_workoutId_fkey"
        FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
