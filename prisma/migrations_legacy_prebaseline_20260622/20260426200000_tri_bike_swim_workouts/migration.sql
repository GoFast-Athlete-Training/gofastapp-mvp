-- CreateEnum
CREATE TYPE "TriSport" AS ENUM ('Swim', 'Bike', 'Run');

-- AlterTable
ALTER TABLE "Athlete" ADD COLUMN "ftpWatts" INTEGER;

-- CreateTable
CREATE TABLE "bike_workout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "ftpWattsSnapshot" INTEGER,
    "estimatedDurationSeconds" INTEGER,
    "garminWorkoutId" INTEGER,
    "garminScheduleId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bike_workout_step" (
    "id" TEXT NOT NULL,
    "bikeWorkoutId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "repeatCount" INTEGER,
    "durationType" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "powerWattsLow" INTEGER,
    "powerWattsHigh" INTEGER,
    "heartRateLow" INTEGER,
    "heartRateHigh" INTEGER,
    "cadenceLow" INTEGER,
    "cadenceHigh" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_workout_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swim_workout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "poolLengthMeters" INTEGER,
    "cssSecPer100m" INTEGER,
    "garminWorkoutId" INTEGER,
    "garminScheduleId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swim_workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swim_workout_step" (
    "id" TEXT NOT NULL,
    "swimWorkoutId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "repeatCount" INTEGER,
    "durationType" TEXT NOT NULL,
    "durationMeters" INTEGER,
    "durationSeconds" INTEGER,
    "paceSecPer100mLow" INTEGER,
    "paceSecPer100mHigh" INTEGER,
    "strokeType" TEXT,
    "equipment" TEXT,
    "heartRateLow" INTEGER,
    "heartRateHigh" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swim_workout_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tri_workout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tri_workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tri_workout_leg" (
    "id" TEXT NOT NULL,
    "triWorkoutId" TEXT NOT NULL,
    "legOrder" INTEGER NOT NULL,
    "sport" "TriSport" NOT NULL,
    "title" TEXT,
    "bikeWorkoutId" TEXT,
    "swimWorkoutId" TEXT,
    "runWorkoutId" TEXT,

    CONSTRAINT "tri_workout_leg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bike_workout_athleteId_idx" ON "bike_workout"("athleteId");

-- CreateIndex
CREATE INDEX "bike_workout_athleteId_date_idx" ON "bike_workout"("athleteId", "date");

-- CreateIndex
CREATE INDEX "bike_workout_step_bikeWorkoutId_idx" ON "bike_workout_step"("bikeWorkoutId");

-- CreateIndex
CREATE INDEX "bike_workout_step_bikeWorkoutId_stepOrder_idx" ON "bike_workout_step"("bikeWorkoutId", "stepOrder");

-- CreateIndex
CREATE INDEX "swim_workout_athleteId_idx" ON "swim_workout"("athleteId");

-- CreateIndex
CREATE INDEX "swim_workout_athleteId_date_idx" ON "swim_workout"("athleteId", "date");

-- CreateIndex
CREATE INDEX "swim_workout_step_swimWorkoutId_idx" ON "swim_workout_step"("swimWorkoutId");

-- CreateIndex
CREATE INDEX "swim_workout_step_swimWorkoutId_stepOrder_idx" ON "swim_workout_step"("swimWorkoutId", "stepOrder");

-- CreateIndex
CREATE INDEX "tri_workout_athleteId_idx" ON "tri_workout"("athleteId");

-- CreateIndex
CREATE INDEX "tri_workout_athleteId_date_idx" ON "tri_workout"("athleteId", "date");

-- CreateIndex
CREATE INDEX "tri_workout_leg_triWorkoutId_idx" ON "tri_workout_leg"("triWorkoutId");

-- CreateIndex
CREATE INDEX "tri_workout_leg_triWorkoutId_legOrder_idx" ON "tri_workout_leg"("triWorkoutId", "legOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tri_workout_leg_bikeWorkoutId_key" ON "tri_workout_leg"("bikeWorkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "tri_workout_leg_swimWorkoutId_key" ON "tri_workout_leg"("swimWorkoutId");

-- CreateIndex
CREATE UNIQUE INDEX "tri_workout_leg_runWorkoutId_key" ON "tri_workout_leg"("runWorkoutId");

-- AddForeignKey
ALTER TABLE "bike_workout" ADD CONSTRAINT "bike_workout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bike_workout_step" ADD CONSTRAINT "bike_workout_step_bikeWorkoutId_fkey" FOREIGN KEY ("bikeWorkoutId") REFERENCES "bike_workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_workout" ADD CONSTRAINT "swim_workout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swim_workout_step" ADD CONSTRAINT "swim_workout_step_swimWorkoutId_fkey" FOREIGN KEY ("swimWorkoutId") REFERENCES "swim_workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tri_workout" ADD CONSTRAINT "tri_workout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_triWorkoutId_fkey" FOREIGN KEY ("triWorkoutId") REFERENCES "tri_workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_bikeWorkoutId_fkey" FOREIGN KEY ("bikeWorkoutId") REFERENCES "bike_workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_swimWorkoutId_fkey" FOREIGN KEY ("swimWorkoutId") REFERENCES "swim_workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_runWorkoutId_fkey" FOREIGN KEY ("runWorkoutId") REFERENCES "workouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
