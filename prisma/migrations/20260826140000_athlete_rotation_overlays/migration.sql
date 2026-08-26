-- Athlete-owned rotation overlays and quality configs (MVP1)

CREATE TABLE "athlete_preset_long_run_order" (
    "id" TEXT NOT NULL,
    "athletePresetId" TEXT NOT NULL,
    "longRunConfigPositionId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_preset_long_run_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "athlete_preset_easy_order" (
    "id" TEXT NOT NULL,
    "athletePresetId" TEXT NOT NULL,
    "easyConfigPositionId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_preset_easy_order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "athlete_tempo_config" (
    "id" TEXT NOT NULL,
    "athletePresetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_tempo_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "athlete_tempo_config_position" (
    "id" TEXT NOT NULL,
    "athleteTempoConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.125,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_tempo_config_position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "athlete_intervals_config" (
    "id" TEXT NOT NULL,
    "athletePresetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_intervals_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "athlete_intervals_config_position" (
    "id" TEXT NOT NULL,
    "athleteIntervalsConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.125,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_intervals_config_position_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_preset_long_run_order_athletePresetId_longRunConfigPositionId_key" ON "athlete_preset_long_run_order"("athletePresetId", "longRunConfigPositionId");
CREATE UNIQUE INDEX "athlete_preset_long_run_order_athletePresetId_cyclePosition_key" ON "athlete_preset_long_run_order"("athletePresetId", "cyclePosition");
CREATE INDEX "athlete_preset_long_run_order_athletePresetId_idx" ON "athlete_preset_long_run_order"("athletePresetId");
CREATE INDEX "athlete_preset_long_run_order_longRunConfigPositionId_idx" ON "athlete_preset_long_run_order"("longRunConfigPositionId");

CREATE UNIQUE INDEX "athlete_preset_easy_order_athletePresetId_easyConfigPositionId_key" ON "athlete_preset_easy_order"("athletePresetId", "easyConfigPositionId");
CREATE UNIQUE INDEX "athlete_preset_easy_order_athletePresetId_cyclePosition_key" ON "athlete_preset_easy_order"("athletePresetId", "cyclePosition");
CREATE INDEX "athlete_preset_easy_order_athletePresetId_idx" ON "athlete_preset_easy_order"("athletePresetId");
CREATE INDEX "athlete_preset_easy_order_easyConfigPositionId_idx" ON "athlete_preset_easy_order"("easyConfigPositionId");

CREATE UNIQUE INDEX "athlete_tempo_config_athletePresetId_key" ON "athlete_tempo_config"("athletePresetId");

CREATE UNIQUE INDEX "athlete_tempo_config_position_athleteTempoConfigId_cyclePosition_key" ON "athlete_tempo_config_position"("athleteTempoConfigId", "cyclePosition");
CREATE INDEX "athlete_tempo_config_position_athleteTempoConfigId_idx" ON "athlete_tempo_config_position"("athleteTempoConfigId");

CREATE UNIQUE INDEX "athlete_intervals_config_athletePresetId_key" ON "athlete_intervals_config"("athletePresetId");

CREATE UNIQUE INDEX "athlete_intervals_config_position_athleteIntervalsConfigId_cyclePosition_key" ON "athlete_intervals_config_position"("athleteIntervalsConfigId", "cyclePosition");
CREATE INDEX "athlete_intervals_config_position_athleteIntervalsConfigId_idx" ON "athlete_intervals_config_position"("athleteIntervalsConfigId");

ALTER TABLE "athlete_preset_long_run_order" ADD CONSTRAINT "athlete_preset_long_run_order_athletePresetId_fkey" FOREIGN KEY ("athletePresetId") REFERENCES "athlete_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_preset_long_run_order" ADD CONSTRAINT "athlete_preset_long_run_order_longRunConfigPositionId_fkey" FOREIGN KEY ("longRunConfigPositionId") REFERENCES "long_run_config_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athlete_preset_easy_order" ADD CONSTRAINT "athlete_preset_easy_order_athletePresetId_fkey" FOREIGN KEY ("athletePresetId") REFERENCES "athlete_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_preset_easy_order" ADD CONSTRAINT "athlete_preset_easy_order_easyConfigPositionId_fkey" FOREIGN KEY ("easyConfigPositionId") REFERENCES "easy_config_position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athlete_tempo_config" ADD CONSTRAINT "athlete_tempo_config_athletePresetId_fkey" FOREIGN KEY ("athletePresetId") REFERENCES "athlete_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athlete_tempo_config_position" ADD CONSTRAINT "athlete_tempo_config_position_athleteTempoConfigId_fkey" FOREIGN KEY ("athleteTempoConfigId") REFERENCES "athlete_tempo_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_tempo_config_position" ADD CONSTRAINT "athlete_tempo_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "athlete_intervals_config" ADD CONSTRAINT "athlete_intervals_config_athletePresetId_fkey" FOREIGN KEY ("athletePresetId") REFERENCES "athlete_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "athlete_intervals_config_position" ADD CONSTRAINT "athlete_intervals_config_position_athleteIntervalsConfigId_fkey" FOREIGN KEY ("athleteIntervalsConfigId") REFERENCES "athlete_intervals_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_intervals_config_position" ADD CONSTRAINT "athlete_intervals_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
