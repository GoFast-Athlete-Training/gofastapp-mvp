-- CreateTable
CREATE TABLE "easy_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "easy_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "easy_config_position" (
    "id" TEXT NOT NULL,
    "easyConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "easy_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "easy_config_name_idx" ON "easy_config"("name");

-- CreateIndex
CREATE INDEX "easy_config_position_easyConfigId_idx" ON "easy_config_position"("easyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "easy_config_position_easyConfigId_cyclePosition_key" ON "easy_config_position"("easyConfigId", "cyclePosition");

-- AlterTable
ALTER TABLE "training_plan_preset" ADD COLUMN "easyConfigId" TEXT;

-- AddForeignKey
ALTER TABLE "easy_config_position" ADD CONSTRAINT "easy_config_position_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "easy_config_position" ADD CONSTRAINT "easy_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
