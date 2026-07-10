-- CreateEnum
CREATE TYPE "PublicTrainingPlanVisibility" AS ENUM ('DRAFT', 'PUBLIC', 'UNLISTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanCustomWorkoutVisibility" AS ENUM ('PRIVATE', 'PUBLIC_WITH_PLAN');

-- CreateTable
CREATE TABLE "public_training_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "authorAthleteId" TEXT NOT NULL,
    "sourceTrainingPlanId" TEXT NOT NULL,
    "sourcePresetId" TEXT,
    "visibility" "PublicTrainingPlanVisibility" NOT NULL DEFAULT 'DRAFT',
    "targetDistanceLabel" TEXT,
    "durationWeeks" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "previewSnapshot" JSONB,
    "customWorkoutSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_custom_workouts" (
    "id" TEXT NOT NULL,
    "trainingPlanId" TEXT NOT NULL,
    "authorAthleteId" TEXT NOT NULL,
    "sourcePublicPlanId" TEXT,
    "sourceCustomWorkoutId" TEXT,
    "weekNumber" INTEGER NOT NULL,
    "dow" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "workoutType" "WorkoutType" NOT NULL DEFAULT 'Easy',
    "content" JSONB,
    "leaderNotes" TEXT,
    "visibility" "PlanCustomWorkoutVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_custom_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_training_plans_slug_key" ON "public_training_plans"("slug");

-- CreateIndex
CREATE INDEX "public_training_plans_authorAthleteId_idx" ON "public_training_plans"("authorAthleteId");

-- CreateIndex
CREATE INDEX "public_training_plans_visibility_publishedAt_idx" ON "public_training_plans"("visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "public_training_plans_sourceTrainingPlanId_idx" ON "public_training_plans"("sourceTrainingPlanId");

-- CreateIndex
CREATE INDEX "plan_custom_workouts_trainingPlanId_weekNumber_idx" ON "plan_custom_workouts"("trainingPlanId", "weekNumber");

-- CreateIndex
CREATE INDEX "plan_custom_workouts_authorAthleteId_idx" ON "plan_custom_workouts"("authorAthleteId");

-- AddForeignKey
ALTER TABLE "public_training_plans" ADD CONSTRAINT "public_training_plans_authorAthleteId_fkey" FOREIGN KEY ("authorAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_training_plans" ADD CONSTRAINT "public_training_plans_sourceTrainingPlanId_fkey" FOREIGN KEY ("sourceTrainingPlanId") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_training_plans" ADD CONSTRAINT "public_training_plans_sourcePresetId_fkey" FOREIGN KEY ("sourcePresetId") REFERENCES "training_plan_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_custom_workouts" ADD CONSTRAINT "plan_custom_workouts_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_custom_workouts" ADD CONSTRAINT "plan_custom_workouts_authorAthleteId_fkey" FOREIGN KEY ("authorAthleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_custom_workouts" ADD CONSTRAINT "plan_custom_workouts_sourcePublicPlanId_fkey" FOREIGN KEY ("sourcePublicPlanId") REFERENCES "public_training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_custom_workouts" ADD CONSTRAINT "plan_custom_workouts_sourceCustomWorkoutId_fkey" FOREIGN KEY ("sourceCustomWorkoutId") REFERENCES "plan_custom_workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
