-- Mirror Training Manage plan → build → taper → race week on prod.

CREATE TABLE IF NOT EXISTS "shakeout_run_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalMiles" DOUBLE PRECISION NOT NULL,
    "paceOffsetSecPerMile" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shakeout_run_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "build_preset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startLongRunMiles" DOUBLE PRECISION,
    "peakLongRunMiles" DOUBLE PRECISION,
    "longRunCutback" DOUBLE PRECISION,
    "maxWeeklyMiles" INTEGER,
    "longRunConfigId" TEXT,
    "intervalsConfigId" TEXT,
    "tempoConfigId" TEXT,
    "easyConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "build_preset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "taper_preset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "week1TotalMiles" DOUBLE PRECISION,
    "week1LongRunMiles" DOUBLE PRECISION,
    "week2TotalMiles" DOUBLE PRECISION,
    "week2LongRunMiles" DOUBLE PRECISION,
    "weekPins" JSONB NOT NULL DEFAULT '[]',
    "longRunConfigId" TEXT,
    "intervalsConfigId" TEXT,
    "tempoConfigId" TEXT,
    "easyConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taper_preset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "race_week_preset" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_week_preset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "buildPresetId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "taperPresetId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "raceWeekPresetId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "snapPeakLongRunMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "snapPeakWeeklyMiles" INTEGER;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "snapTaperWeek1TotalMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "snapTaperWeek1LongRunMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "snapTaperWeek2TotalMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "snapTaperWeek2LongRunMiles" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "training_plan_preset_buildPresetId_idx" ON "training_plan_preset"("buildPresetId");
CREATE INDEX IF NOT EXISTS "training_plan_preset_taperPresetId_idx" ON "training_plan_preset"("taperPresetId");
CREATE INDEX IF NOT EXISTS "training_plan_preset_raceWeekPresetId_idx" ON "training_plan_preset"("raceWeekPresetId");

CREATE INDEX IF NOT EXISTS "build_preset_longRunConfigId_idx" ON "build_preset"("longRunConfigId");
CREATE INDEX IF NOT EXISTS "build_preset_intervalsConfigId_idx" ON "build_preset"("intervalsConfigId");
CREATE INDEX IF NOT EXISTS "build_preset_tempoConfigId_idx" ON "build_preset"("tempoConfigId");
CREATE INDEX IF NOT EXISTS "build_preset_easyConfigId_idx" ON "build_preset"("easyConfigId");

CREATE INDEX IF NOT EXISTS "taper_preset_longRunConfigId_idx" ON "taper_preset"("longRunConfigId");
CREATE INDEX IF NOT EXISTS "taper_preset_intervalsConfigId_idx" ON "taper_preset"("intervalsConfigId");
CREATE INDEX IF NOT EXISTS "taper_preset_tempoConfigId_idx" ON "taper_preset"("tempoConfigId");
CREATE INDEX IF NOT EXISTS "taper_preset_easyConfigId_idx" ON "taper_preset"("easyConfigId");

CREATE INDEX IF NOT EXISTS "shakeout_run_config_name_idx" ON "shakeout_run_config"("name");

ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_preset" ADD CONSTRAINT "build_preset_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "taper_preset" ADD CONSTRAINT "taper_preset_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_buildPresetId_fkey" FOREIGN KEY ("buildPresetId") REFERENCES "build_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_taperPresetId_fkey" FOREIGN KEY ("taperPresetId") REFERENCES "taper_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_raceWeekPresetId_fkey" FOREIGN KEY ("raceWeekPresetId") REFERENCES "race_week_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
