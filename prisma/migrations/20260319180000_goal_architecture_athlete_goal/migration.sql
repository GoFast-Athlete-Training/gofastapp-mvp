-- Goal architecture: AthleteGoal + TrainingPreferences; strip goals from training_plans; drop race_goal_intent

-- CreateTable athlete_goals
CREATE TABLE "athlete_goals" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "distance" TEXT NOT NULL,
    "goalTime" TEXT,
    "goalRacePace" INTEGER,
    "goalPace5K" INTEGER,
    "targetByDate" TIMESTAMP(3) NOT NULL,
    "raceRegistryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "athlete_goals_athleteId_idx" ON "athlete_goals"("athleteId");
CREATE INDEX "athlete_goals_athleteId_status_idx" ON "athlete_goals"("athleteId", "status");
CREATE INDEX "athlete_goals_raceRegistryId_idx" ON "athlete_goals"("raceRegistryId");

ALTER TABLE "athlete_goals" ADD CONSTRAINT "athlete_goals_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "athlete_goals" ADD CONSTRAINT "athlete_goals_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable training_preferences
CREATE TABLE "training_preferences" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "preferredDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "weeklyMileageTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_preferences_athleteId_key" ON "training_preferences"("athleteId");

ALTER TABLE "training_preferences" ADD CONSTRAINT "training_preferences_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill athlete_goals from race_goal_intent (paces recomputed by app on first save / goal-service)
INSERT INTO "athlete_goals" ("id", "athleteId", "distance", "goalTime", "goalRacePace", "goalPace5K", "targetByDate", "raceRegistryId", "status", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    rgi."athleteId",
    LOWER(COALESCE(NULLIF(TRIM(rr."raceType"), ''), '5k')),
    rgi."goalTime",
    NULL,
    NULL,
    COALESCE(rr."raceDate", NOW() + INTERVAL '90 days'),
    rgi."raceId",
    'ACTIVE',
    rgi."createdAt",
    NOW()
FROM "race_goal_intent" rgi
LEFT JOIN "race_registry" rr ON rr."id" = rgi."raceId"
WHERE rgi."goalTime" IS NOT NULL OR rgi."raceId" IS NOT NULL;

-- Backfill training_preferences from latest training_plans row per athlete
INSERT INTO "training_preferences" ("id", "athleteId", "preferredDays", "weeklyMileageTarget", "createdAt", "updatedAt")
SELECT DISTINCT ON (tp."athleteId")
    gen_random_uuid()::text,
    tp."athleteId",
    tp."preferredDays",
    tp."currentWeeklyMileage",
    tp."createdAt",
    NOW()
FROM "training_plans" tp
WHERE tp."preferredDays" IS NOT NULL
ORDER BY tp."athleteId", tp."createdAt" DESC;

-- Link training_plans to athlete goals
ALTER TABLE "training_plans" ADD COLUMN "athleteGoalId" TEXT;

CREATE INDEX "training_plans_athleteGoalId_idx" ON "training_plans"("athleteGoalId");

ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_athleteGoalId_fkey" FOREIGN KEY ("athleteGoalId") REFERENCES "athlete_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Strip goal / preference columns from training_plans (moved to AthleteGoal / TrainingPreferences)
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "goalTime";
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "goalRacePace";
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "predictedRacePace";
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "goalPace5K";
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "current5KPace";
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "preferredDays";

DROP TABLE IF EXISTS "race_goal_intent";
