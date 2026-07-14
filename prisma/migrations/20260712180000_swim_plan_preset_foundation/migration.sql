-- Swim plan preset foundation: standalone swim_plan_preset, catalogue, rotation configs,
-- athlete FourHunMSwPace benchmark, and swim_workout_step Garmin/materializer fields.

-- CreateEnum
CREATE TYPE "SwimWorkoutType" AS ENUM ('EnduranceSwim', 'ThresholdSwim', 'PowerSwim', 'LongSwim');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN "FourHunMSwPace" INTEGER;

-- CreateTable
CREATE TABLE "swim_workout_catalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "workoutType" "SwimWorkoutType" NOT NULL,
    "totalWorkDistanceMeters" INTEGER,
    "repDistanceMeters" INTEGER,
    "repCount" INTEGER,
    "recoverySeconds" INTEGER,
    "recoveryMeters" INTEGER,
    "warmupMeters" INTEGER,
    "cooldownMeters" INTEGER,
    "paceOffsetSecPer100m" INTEGER,
    "segmentPattern" JSONB,
    "trainingIntent" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swim_workout_catalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swim_rotation_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workoutType" "SwimWorkoutType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swim_rotation_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swim_rotation_config_position" (
    "id" TEXT NOT NULL,
    "swimRotationConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swim_rotation_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swim_plan_preset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "publicDescription" TEXT,
    "goalSwimDistanceMeters" INTEGER,
    "personaId" TEXT,
    "goalId" TEXT,
    "coachIntent" TEXT,
    "objectiveOfPlan" TEXT,
    "athletePersonaCapability" "AthletePersonaCapability",
    "athletePersonaGoal" TEXT,
    "athletePersonaDedication" "AthletePersonaDedication",
    "coachPlanOverview" JSONB,
    "paceProfile" JSONB,
    "workoutStructure" JSONB,
    "cycleLen" INTEGER NOT NULL DEFAULT 4,
    "weeklyProgressionPattern" JSONB,
    "recommendationMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "recommendedWeeklyMeters" INTEGER,
    "minWeeklyMeters" INTEGER NOT NULL DEFAULT 4000,
    "maxWeeklyMeters" INTEGER,
    "taperWeeks" INTEGER NOT NULL DEFAULT 2,
    "taperVolumeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "longSwimShareOfWeek" DOUBLE PRECISION,
    "longSwimMinMeters" INTEGER,
    "longSwimMaxMeters" INTEGER,
    "enduranceIdealDow" INTEGER NOT NULL DEFAULT 2,
    "thresholdIdealDow" INTEGER NOT NULL DEFAULT 4,
    "powerIdealDow" INTEGER NOT NULL DEFAULT 3,
    "longSwimIdealDow" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enduranceConfigId" TEXT,
    "thresholdConfigId" TEXT,
    "powerConfigId" TEXT,
    "longSwimConfigId" TEXT,

    CONSTRAINT "swim_plan_preset_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "swim_workout_step" ADD COLUMN "paceNote" TEXT,
ADD COLUMN "drillType" TEXT,
ADD COLUMN "restSeconds" INTEGER,
ADD COLUMN "targetZone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "swim_workout_catalogue_slug_key" ON "swim_workout_catalogue"("slug");

-- CreateIndex
CREATE INDEX "swim_workout_catalogue_workoutType_idx" ON "swim_workout_catalogue"("workoutType");

-- CreateIndex
CREATE UNIQUE INDEX "swim_workout_catalogue_name_workoutType_key" ON "swim_workout_catalogue"("name", "workoutType");

-- CreateIndex
CREATE INDEX "swim_rotation_config_name_idx" ON "swim_rotation_config"("name");

-- CreateIndex
CREATE INDEX "swim_rotation_config_workoutType_idx" ON "swim_rotation_config"("workoutType");

-- CreateIndex
CREATE INDEX "swim_rotation_config_position_swimRotationConfigId_idx" ON "swim_rotation_config_position"("swimRotationConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "swim_rotation_config_position_swimRotationConfigId_cyclePosition_key" ON "swim_rotation_config_position"("swimRotationConfigId", "cyclePosition");

-- CreateIndex
CREATE UNIQUE INDEX "swim_plan_preset_slug_key" ON "swim_plan_preset"("slug");

-- AddForeignKey
ALTER TABLE "swim_rotation_config_position" ADD CONSTRAINT "swim_rotation_config_position_swimRotationConfigId_fkey" FOREIGN KEY ("swimRotationConfigId") REFERENCES "swim_rotation_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_rotation_config_position" ADD CONSTRAINT "swim_rotation_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "swim_workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_plan_preset" ADD CONSTRAINT "swim_plan_preset_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "training_plan_persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_plan_preset" ADD CONSTRAINT "swim_plan_preset_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "training_plan_goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_plan_preset" ADD CONSTRAINT "swim_plan_preset_enduranceConfigId_fkey" FOREIGN KEY ("enduranceConfigId") REFERENCES "swim_rotation_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_plan_preset" ADD CONSTRAINT "swim_plan_preset_thresholdConfigId_fkey" FOREIGN KEY ("thresholdConfigId") REFERENCES "swim_rotation_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_plan_preset" ADD CONSTRAINT "swim_plan_preset_powerConfigId_fkey" FOREIGN KEY ("powerConfigId") REFERENCES "swim_rotation_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_plan_preset" ADD CONSTRAINT "swim_plan_preset_longSwimConfigId_fkey" FOREIGN KEY ("longSwimConfigId") REFERENCES "swim_rotation_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
