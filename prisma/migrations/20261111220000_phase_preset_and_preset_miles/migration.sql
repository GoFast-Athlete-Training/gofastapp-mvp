-- One holster table. Existing build, taper, and race-week rows are copied, not rewritten.

CREATE TABLE "phase_preset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "longRunConfigId" TEXT,
    "intervalsConfigId" TEXT,
    "tempoConfigId" TEXT,
    "easyConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "phase_preset_pkey" PRIMARY KEY ("id")
);

INSERT INTO "phase_preset" (
    "id", "name", "longRunConfigId", "intervalsConfigId", "tempoConfigId", "easyConfigId", "createdAt", "updatedAt"
)
SELECT
    "id", "name", "longRunConfigId", "intervalsConfigId", "tempoConfigId", "easyConfigId", "createdAt", "updatedAt"
FROM "build_preset";

INSERT INTO "phase_preset" (
    "id", "name", "longRunConfigId", "intervalsConfigId", "tempoConfigId", "easyConfigId", "createdAt", "updatedAt"
)
SELECT
    t."id", t."name", t."longRunConfigId", t."intervalsConfigId", t."tempoConfigId", t."easyConfigId", t."createdAt", t."updatedAt"
FROM "taper_preset" t
WHERE NOT EXISTS (SELECT 1 FROM "phase_preset" p WHERE p."id" = t."id");

INSERT INTO "phase_preset" ("id", "name", "createdAt", "updatedAt")
SELECT r."id", r."title", r."createdAt", r."updatedAt"
FROM "race_week_preset" r
WHERE NOT EXISTS (SELECT 1 FROM "phase_preset" p WHERE p."id" = r."id");

CREATE INDEX "phase_preset_longRunConfigId_idx" ON "phase_preset"("longRunConfigId");
CREATE INDEX "phase_preset_intervalsConfigId_idx" ON "phase_preset"("intervalsConfigId");
CREATE INDEX "phase_preset_tempoConfigId_idx" ON "phase_preset"("tempoConfigId");
CREATE INDEX "phase_preset_easyConfigId_idx" ON "phase_preset"("easyConfigId");

ALTER TABLE "phase_preset" ADD CONSTRAINT "phase_preset_longRunConfigId_fkey"
    FOREIGN KEY ("longRunConfigId") REFERENCES "long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phase_preset" ADD CONSTRAINT "phase_preset_intervalsConfigId_fkey"
    FOREIGN KEY ("intervalsConfigId") REFERENCES "intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phase_preset" ADD CONSTRAINT "phase_preset_tempoConfigId_fkey"
    FOREIGN KEY ("tempoConfigId") REFERENCES "tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phase_preset" ADD CONSTRAINT "phase_preset_easyConfigId_fkey"
    FOREIGN KEY ("easyConfigId") REFERENCES "easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "training_plan_preset" ADD COLUMN "entryLongRunMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "peakLongRunMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "baseEndLongRunMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "baseEndWeeklyMiles" INTEGER;
ALTER TABLE "training_plan_preset" ADD COLUMN "longRunCutback" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "taperWeek1TotalMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "taperWeek1LongRunMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "taperWeek2TotalMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "taperWeek2LongRunMiles" DOUBLE PRECISION;
ALTER TABLE "training_plan_preset" ADD COLUMN "raceWeekDayMiles" JSONB;

ALTER TABLE "training_plan_preset" ADD COLUMN "baseBuildPhasePresetId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN "buildToPeakPhasePresetId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN "taperPhasePresetId" TEXT;
ALTER TABLE "training_plan_preset" ADD COLUMN "raceWeekPhasePresetId" TEXT;

UPDATE "training_plan_preset" AS p
SET
    "entryLongRunMiles" = b."startLongRunMiles",
    "peakLongRunMiles" = b."peakLongRunMiles",
    "longRunCutback" = b."longRunCutback"
FROM "build_preset" AS b
WHERE p."buildPresetId" = b."id";

UPDATE "training_plan_preset" AS p
SET
    "baseEndLongRunMiles" = b."startLongRunMiles",
    "baseEndWeeklyMiles" = b."maxWeeklyMiles"
FROM "build_preset" AS b
WHERE p."baseBuildPresetId" = b."id";

UPDATE "training_plan_preset" AS p
SET
    "taperWeek1TotalMiles" = t."week1TotalMiles",
    "taperWeek1LongRunMiles" = t."week1LongRunMiles",
    "taperWeek2TotalMiles" = t."week2TotalMiles",
    "taperWeek2LongRunMiles" = t."week2LongRunMiles"
FROM "taper_preset" AS t
WHERE p."taperPresetId" = t."id";

UPDATE "training_plan_preset" AS p
SET "raceWeekDayMiles" = sub.miles
FROM (
    SELECT
        r."id",
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'offsetFromRace', (elem->>'offsetFromRace')::numeric,
                    'prescribedMiles', (elem->>'prescribedMiles')::numeric
                )
            )
            FROM jsonb_array_elements(
                CASE
                    WHEN jsonb_typeof(r."slots"::jsonb) = 'array' THEN r."slots"::jsonb
                    ELSE '[]'::jsonb
                END
            ) AS elem
            WHERE (elem->>'prescribedMiles') IS NOT NULL
              AND (elem->>'prescribedMiles') <> ''
        ) AS miles
    FROM "race_week_preset" AS r
) AS sub
WHERE p."raceWeekPresetId" = sub."id"
  AND sub.miles IS NOT NULL;

UPDATE "training_plan_preset" AS p
SET
    "baseBuildPhasePresetId" = p."baseBuildPresetId",
    "buildToPeakPhasePresetId" = p."buildPresetId",
    "taperPhasePresetId" = p."taperPresetId",
    "raceWeekPhasePresetId" = p."raceWeekPresetId";

UPDATE "training_plan_preset" AS p
SET "baseBuildPhasePresetId" = NULL
WHERE "baseBuildPhasePresetId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "phase_preset" ph WHERE ph."id" = p."baseBuildPhasePresetId");

UPDATE "training_plan_preset" AS p
SET "buildToPeakPhasePresetId" = NULL
WHERE "buildToPeakPhasePresetId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "phase_preset" ph WHERE ph."id" = p."buildToPeakPhasePresetId");

UPDATE "training_plan_preset" AS p
SET "taperPhasePresetId" = NULL
WHERE "taperPhasePresetId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "phase_preset" ph WHERE ph."id" = p."taperPhasePresetId");

UPDATE "training_plan_preset" AS p
SET "raceWeekPhasePresetId" = NULL
WHERE "raceWeekPhasePresetId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "phase_preset" ph WHERE ph."id" = p."raceWeekPhasePresetId");

CREATE INDEX "training_plan_preset_baseBuildPhasePresetId_idx" ON "training_plan_preset"("baseBuildPhasePresetId");
CREATE INDEX "training_plan_preset_buildToPeakPhasePresetId_idx" ON "training_plan_preset"("buildToPeakPhasePresetId");
CREATE INDEX "training_plan_preset_taperPhasePresetId_idx" ON "training_plan_preset"("taperPhasePresetId");
CREATE INDEX "training_plan_preset_raceWeekPhasePresetId_idx" ON "training_plan_preset"("raceWeekPhasePresetId");

ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_baseBuildPhasePresetId_fkey"
    FOREIGN KEY ("baseBuildPhasePresetId") REFERENCES "phase_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_buildToPeakPhasePresetId_fkey"
    FOREIGN KEY ("buildToPeakPhasePresetId") REFERENCES "phase_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_taperPhasePresetId_fkey"
    FOREIGN KEY ("taperPhasePresetId") REFERENCES "phase_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_raceWeekPhasePresetId_fkey"
    FOREIGN KEY ("raceWeekPhasePresetId") REFERENCES "phase_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
