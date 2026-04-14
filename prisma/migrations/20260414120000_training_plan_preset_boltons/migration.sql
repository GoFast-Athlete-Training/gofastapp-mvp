-- Replace flat plan_gen_config with training_plan_preset + two boltons (volume + workout).

CREATE TABLE "training_plan_preset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plan_preset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_plan_preset_slug_key" ON "training_plan_preset"("slug");

CREATE TABLE "preset_volume_constraints" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "taperWeeks" INTEGER NOT NULL DEFAULT 3,
    "peakWeeks" INTEGER NOT NULL DEFAULT 4,
    "taperLongRunAnchors" JSONB NOT NULL,
    "peakLongRunMiles" INTEGER NOT NULL DEFAULT 22,
    "cutbackWeekModulo" INTEGER NOT NULL DEFAULT 3,
    "weeklyMileageMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "taperMileageReduction" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "longRunCapFraction" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "minWeeklyMiles" INTEGER NOT NULL DEFAULT 40,
    "minLongMiles" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "minEasyPerDayMiles" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "minEasyWeekMiles" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preset_volume_constraints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "preset_volume_constraints_presetId_key" UNIQUE ("presetId")
);

CREATE TABLE "preset_workout_config" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "tempoStartMiles" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "intervalStartMiles" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "minTempoMiles" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "minIntervalMiles" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "tempoIdealDow" INTEGER NOT NULL DEFAULT 2,
    "intervalIdealDow" INTEGER NOT NULL DEFAULT 4,
    "longRunDefaultDow" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preset_workout_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "preset_workout_config_presetId_key" UNIQUE ("presetId")
);

ALTER TABLE "preset_volume_constraints"
    ADD CONSTRAINT "preset_volume_constraints_presetId_fkey"
    FOREIGN KEY ("presetId") REFERENCES "training_plan_preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "preset_workout_config"
    ADD CONSTRAINT "preset_workout_config_presetId_fkey"
    FOREIGN KEY ("presetId") REFERENCES "training_plan_preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate rows from plan_gen_config into new tables (preserve preset id so training_plans FK stays valid)
INSERT INTO "training_plan_preset" ("id", "slug", "title", "description", "createdAt", "updatedAt")
SELECT "id", "slug", "name", NULL, "createdAt", "updatedAt"
FROM "plan_gen_config";

INSERT INTO "preset_volume_constraints" (
    "id", "presetId", "taperWeeks", "peakWeeks", "taperLongRunAnchors", "peakLongRunMiles", "cutbackWeekModulo",
    "weeklyMileageMultiplier", "taperMileageReduction", "longRunCapFraction", "minWeeklyMiles",
    "minLongMiles", "minEasyPerDayMiles", "minEasyWeekMiles", "createdAt", "updatedAt"
)
SELECT
    'pvc_' || "id",
    "id",
    "taperWeeks", "peakWeeks", "taperLongRunAnchors", "peakLongRunMiles", "cutbackWeekModulo",
    "weeklyMileageMultiplier", "taperMileageReduction", "longRunCapFraction", "minWeeklyMiles",
    "minLongMiles", "minEasyPerDayMiles", "minEasyWeekMiles", "createdAt", "updatedAt"
FROM "plan_gen_config";

INSERT INTO "preset_workout_config" (
    "id", "presetId", "tempoStartMiles", "intervalStartMiles", "minTempoMiles", "minIntervalMiles",
    "tempoIdealDow", "intervalIdealDow", "longRunDefaultDow", "createdAt", "updatedAt"
)
SELECT
    'pwc_' || "id",
    "id",
    "tempoStartMiles", "intervalStartMiles", "minTempoMiles", "minIntervalMiles",
    "tempoIdealDow", "intervalIdealDow", "longRunDefaultDow", "createdAt", "updatedAt"
FROM "plan_gen_config";

ALTER TABLE "training_plans" DROP CONSTRAINT IF EXISTS "training_plans_configId_fkey";

ALTER TABLE "training_plans" RENAME COLUMN "configId" TO "presetId";

ALTER TABLE "training_plans"
    ADD CONSTRAINT "training_plans_presetId_fkey"
    FOREIGN KEY ("presetId") REFERENCES "training_plan_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "training_plans_configId_idx";
CREATE INDEX "training_plans_presetId_idx" ON "training_plans"("presetId");

DROP TABLE "plan_gen_config";
