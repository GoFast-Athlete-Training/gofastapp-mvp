-- CreateTable
CREATE TABLE "run_type_config" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_type_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "run_type_config_presetId_idx" ON "run_type_config"("presetId");

-- CreateIndex
CREATE UNIQUE INDEX "run_type_config_presetId_cyclePosition_key" ON "run_type_config"("presetId", "cyclePosition");

-- AddForeignKey
ALTER TABLE "run_type_config" ADD CONSTRAINT "run_type_config_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "training_plan_preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_type_config" ADD CONSTRAINT "run_type_config_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
