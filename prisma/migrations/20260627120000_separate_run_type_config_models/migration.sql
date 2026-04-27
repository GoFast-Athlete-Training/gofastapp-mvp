-- Separate long_run / intervals / tempo config models; preset volume: base/peak/taper + buildCoef.

-- 1) New config + position tables
CREATE TABLE "long_run_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "long_run_config_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "long_run_config_name_idx" ON "long_run_config"("name");

CREATE TABLE "long_run_config_position" (
    "id" TEXT NOT NULL,
    "longRunConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "long_run_config_position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "intervals_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "intervals_config_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "intervals_config_name_idx" ON "intervals_config"("name");

CREATE TABLE "intervals_config_position" (
    "id" TEXT NOT NULL,
    "intervalsConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "intervals_config_position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tempo_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tempo_config_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tempo_config_name_idx" ON "tempo_config"("name");

CREATE TABLE "tempo_config_position" (
    "id" TEXT NOT NULL,
    "tempoConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tempo_config_position_pkey" PRIMARY KEY ("id")
);

-- 2) Backfill parents from run_type_config
INSERT INTO "long_run_config" ("id", "name", "description", "createdAt", "updatedAt")
SELECT "id", "name", "description", "createdAt", "updatedAt"
FROM "run_type_config"
WHERE "workoutType"::text IN ('LongRun', 'Easy', 'Race');

INSERT INTO "intervals_config" ("id", "name", "description", "createdAt", "updatedAt")
SELECT "id", "name", "description", "createdAt", "updatedAt"
FROM "run_type_config"
WHERE "workoutType"::text = 'Intervals';

INSERT INTO "tempo_config" ("id", "name", "description", "createdAt", "updatedAt")
SELECT "id", "name", "description", "createdAt", "updatedAt"
FROM "run_type_config"
WHERE "workoutType"::text = 'Tempo';

-- 3) Backfill position rows
INSERT INTO "long_run_config_position" ("id", "longRunConfigId", "cyclePosition", "distributionWeight", "catalogueWorkoutId", "createdAt", "updatedAt")
SELECT p."id", p."runTypeConfigId", p."cyclePosition", p."distributionWeight", p."catalogueWorkoutId", p."createdAt", p."updatedAt"
FROM "run_type_config_position" p
INNER JOIN "run_type_config" r ON r."id" = p."runTypeConfigId"
WHERE r."workoutType"::text IN ('LongRun', 'Easy', 'Race');

INSERT INTO "intervals_config_position" ("id", "intervalsConfigId", "cyclePosition", "distributionWeight", "catalogueWorkoutId", "createdAt", "updatedAt")
SELECT p."id", p."runTypeConfigId", p."cyclePosition", p."distributionWeight", p."catalogueWorkoutId", p."createdAt", p."updatedAt"
FROM "run_type_config_position" p
INNER JOIN "run_type_config" r ON r."id" = p."runTypeConfigId"
WHERE r."workoutType"::text = 'Intervals';

INSERT INTO "tempo_config_position" ("id", "tempoConfigId", "cyclePosition", "distributionWeight", "catalogueWorkoutId", "createdAt", "updatedAt")
SELECT p."id", p."runTypeConfigId", p."cyclePosition", p."distributionWeight", p."catalogueWorkoutId", p."createdAt", p."updatedAt"
FROM "run_type_config_position" p
INNER JOIN "run_type_config" r ON r."id" = p."runTypeConfigId"
WHERE r."workoutType"::text = 'Tempo';

-- 4) Preset: three typed FKs
ALTER TABLE "training_plan_preset" ADD COLUMN "longRunConfigId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN "intervalsConfigId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN "tempoConfigId" TEXT;

UPDATE "training_plan_preset" t
SET "longRunConfigId" = t."runTypeConfigId"
FROM "run_type_config" r
WHERE t."runTypeConfigId" = r."id" AND r."workoutType"::text IN ('LongRun', 'Easy', 'Race');

UPDATE "training_plan_preset" t
SET "intervalsConfigId" = t."runTypeConfigId"
FROM "run_type_config" r
WHERE t."runTypeConfigId" = r."id" AND r."workoutType"::text = 'Intervals';

UPDATE "training_plan_preset" t
SET "tempoConfigId" = t."runTypeConfigId"
FROM "run_type_config" r
WHERE t."runTypeConfigId" = r."id" AND r."workoutType"::text = 'Tempo';

-- 5) Volume: new columns then backfill
ALTER TABLE "preset_volume_constraints" ADD COLUMN "maxWeeklyMiles" INTEGER;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "baseMiles" DOUBLE PRECISION;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "peakMiles" DOUBLE PRECISION;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "taperMiles" DOUBLE PRECISION;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "new_buildCoef" DOUBLE PRECISION NOT NULL DEFAULT 1.12;

UPDATE "preset_volume_constraints" v SET
  "peakMiles" = v."longRunPeakPool",
  "taperMiles" = v."longRunPeakPool" * v."cyclePoolTaperCoef",
  "baseMiles" = CASE
    WHEN v."cyclePoolBuildCoef" > 0 AND v."longRunPeakPool" IS NOT NULL
    THEN v."longRunPeakPool" / POWER(v."cyclePoolBuildCoef", 2)
    ELSE COALESCE(v."longRunPeakPool", 0)
  END,
  "new_buildCoef" = v."cyclePoolBuildCoef";

-- Drop old volume columns, rename new_buildCoef -> handled by drop+add
ALTER TABLE "preset_volume_constraints" DROP COLUMN "longRunWeekPct";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "tempoWeekPct";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "intervalsWeekPct";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "longRunPeakPool";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "cyclePoolBuildCoef";
ALTER TABLE "preset_volume_constraints" DROP COLUMN "cyclePoolTaperCoef";

ALTER TABLE "preset_volume_constraints" RENAME COLUMN "new_buildCoef" TO "buildCoef";

-- NOT NULL
ALTER TABLE "preset_volume_constraints" ALTER COLUMN "baseMiles" SET NOT NULL;
ALTER TABLE "preset_volume_constraints" ALTER COLUMN "peakMiles" SET NOT NULL;
ALTER TABLE "preset_volume_constraints" ALTER COLUMN "taperMiles" SET NOT NULL;

-- 6) FKs on new position tables
ALTER TABLE "long_run_config_position" ADD CONSTRAINT "long_run_config_position_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "long_run_config_position" ADD CONSTRAINT "long_run_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "long_run_config_position_longRunConfigId_cyclePosition_key" ON "long_run_config_position"("longRunConfigId", "cyclePosition");
CREATE INDEX "long_run_config_position_longRunConfigId_idx" ON "long_run_config_position"("longRunConfigId");

ALTER TABLE "intervals_config_position" ADD CONSTRAINT "intervals_config_position_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "intervals_config_position" ADD CONSTRAINT "intervals_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "intervals_config_position_intervalsConfigId_cyclePosition_key" ON "intervals_config_position"("intervalsConfigId", "cyclePosition");
CREATE INDEX "intervals_config_position_intervalsConfigId_idx" ON "intervals_config_position"("intervalsConfigId");

ALTER TABLE "tempo_config_position" ADD CONSTRAINT "tempo_config_position_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tempo_config_position" ADD CONSTRAINT "tempo_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "tempo_config_position_tempoConfigId_cyclePosition_key" ON "tempo_config_position"("tempoConfigId", "cyclePosition");
CREATE INDEX "tempo_config_position_tempoConfigId_idx" ON "tempo_config_position"("tempoConfigId");

-- 7) Preset FKs
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "training_plan_preset_longRunConfigId_idx" ON "training_plan_preset"("longRunConfigId");
CREATE INDEX "training_plan_preset_intervalsConfigId_idx" ON "training_plan_preset"("intervalsConfigId");
CREATE INDEX "training_plan_preset_tempoConfigId_idx" ON "training_plan_preset"("tempoConfigId");

-- 8) Drop old run type config
ALTER TABLE "training_plan_preset" DROP CONSTRAINT "training_plan_preset_runTypeConfigId_fkey";
DROP INDEX IF EXISTS "training_plan_preset_runTypeConfigId_idx";
ALTER TABLE "training_plan_preset" DROP COLUMN "runTypeConfigId";

DROP TABLE "run_type_config_position";
DROP TABLE "run_type_config";
