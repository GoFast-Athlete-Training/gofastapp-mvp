-- CreateTable
CREATE TABLE "planned_workouts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "workoutType" "WorkoutType" NOT NULL,
    "athleteId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "catalogueWorkoutId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "estimatedDistanceInMeters" DOUBLE PRECISION,
    "nOffset" INTEGER,
    "weekNumber" INTEGER,
    "dayAssigned" TEXT,
    "planCycleIndex" INTEGER,
    "garminWorkoutId" INTEGER,
    "garminScheduleId" INTEGER,
    "segmentSnapshotJson" JSONB,
    "prescriptionNarrative" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_workout_segments" (
    "id" TEXT NOT NULL,
    "plannedWorkoutId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationType" TEXT NOT NULL,
    "durationValue" DOUBLE PRECISION NOT NULL,
    "targets" JSONB,
    "paceTargetEncodingVersion" INTEGER NOT NULL DEFAULT 2,
    "repeatCount" INTEGER,
    "recoveryDurationType" TEXT,
    "recoveryDurationValue" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_workout_segments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "plannedWorkoutId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "planned_workouts_athleteId_planId_date_key" ON "planned_workouts"("athleteId", "planId", "date");

-- CreateIndex
CREATE INDEX "planned_workouts_athleteId_garminWorkoutId_idx" ON "planned_workouts"("athleteId", "garminWorkoutId");

-- CreateIndex
CREATE INDEX "planned_workouts_planId_date_idx" ON "planned_workouts"("planId", "date");

-- CreateIndex
CREATE INDEX "planned_workouts_catalogueWorkoutId_idx" ON "planned_workouts"("catalogueWorkoutId");

-- CreateIndex
CREATE INDEX "planned_workout_segments_plannedWorkoutId_idx" ON "planned_workout_segments"("plannedWorkoutId");

-- CreateIndex
CREATE INDEX "planned_workout_segments_plannedWorkoutId_stepOrder_idx" ON "planned_workout_segments"("plannedWorkoutId", "stepOrder");

-- CreateIndex
CREATE INDEX "workouts_plannedWorkoutId_idx" ON "workouts"("plannedWorkoutId");

-- AddForeignKey
ALTER TABLE "planned_workouts" ADD CONSTRAINT "planned_workouts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_workouts" ADD CONSTRAINT "planned_workouts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_workouts" ADD CONSTRAINT "planned_workouts_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_workout_segments" ADD CONSTRAINT "planned_workout_segments_plannedWorkoutId_fkey" FOREIGN KEY ("plannedWorkoutId") REFERENCES "planned_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plannedWorkoutId_fkey" FOREIGN KEY ("plannedWorkoutId") REFERENCES "planned_workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
