-- Final cutover: merge legacy athlete_goals into athlete_races, repoint FKs, drop athlete_goals.

-- 1. Deterministic goal backfill onto athlete_races (one winner per race row).
WITH ranked_goals AS (
  SELECT
    g."athleteRaceId",
    g."name",
    g."description",
    g."distance",
    g."goalTime",
    g."goalRacePace",
    g."goalPace5K",
    g."whyGoal",
    g."successLooksLike",
    g."completionFeeling",
    g."motivationIcon",
    ROW_NUMBER() OVER (
      PARTITION BY g."athleteRaceId"
      ORDER BY
        CASE WHEN g."status" = 'ACTIVE' THEN 0 ELSE 1 END,
        g."updatedAt" DESC NULLS LAST,
        g."id" ASC
    ) AS rn
  FROM "athlete_goals" AS g
  WHERE g."athleteRaceId" IS NOT NULL
)
UPDATE "athlete_races" AS ar
SET
  "goalName" = COALESCE(ar."goalName", rg."name"),
  "goalDescription" = COALESCE(ar."goalDescription", rg."description"),
  "goalDistance" = COALESCE(ar."goalDistance", rg."distance"),
  "goalTime" = COALESCE(ar."goalTime", rg."goalTime"),
  "goalRacePace" = COALESCE(ar."goalRacePace", rg."goalRacePace"),
  "goalPace5K" = COALESCE(ar."goalPace5K", rg."goalPace5K"),
  "whyGoal" = COALESCE(ar."whyGoal", rg."whyGoal"),
  "successLooksLike" = COALESCE(ar."successLooksLike", rg."successLooksLike"),
  "completionFeeling" = COALESCE(ar."completionFeeling", rg."completionFeeling"),
  "motivationIcon" = COALESCE(ar."motivationIcon", rg."motivationIcon"),
  "updatedAt" = NOW()
FROM ranked_goals AS rg
WHERE rg."athleteRaceId" = ar."id"
  AND rg.rn = 1;

-- 2. Backfill training_plans.athleteRaceId from legacy athleteGoalId.
UPDATE "training_plans" AS tp
SET "athleteRaceId" = g."athleteRaceId", "updatedAt" = NOW()
FROM "athlete_goals" AS g
WHERE tp."athleteGoalId" = g."id"
  AND tp."athleteRaceId" IS NULL
  AND tp."athleteId" = g."athleteId"
  AND g."athleteRaceId" IS NOT NULL;

-- Legacy compat: goal id was sometimes the athlete race id directly.
UPDATE "training_plans" AS tp
SET "athleteRaceId" = tp."athleteGoalId", "updatedAt" = NOW()
WHERE tp."athleteRaceId" IS NULL
  AND tp."athleteGoalId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "athlete_races" AS ar
    WHERE ar."id" = tp."athleteGoalId"
      AND ar."athleteId" = tp."athleteId"
  );

-- 3. Backfill athlete_race_results.athleteRaceId from legacy goalId.
UPDATE "athlete_race_results" AS rr
SET "athleteRaceId" = g."athleteRaceId", "updatedAt" = NOW()
FROM "athlete_goals" AS g
WHERE rr."goalId" = g."id"
  AND rr."athleteRaceId" IS NULL
  AND rr."athleteId" = g."athleteId"
  AND g."athleteRaceId" IS NOT NULL;

UPDATE "athlete_race_results" AS rr
SET "athleteRaceId" = rr."goalId", "updatedAt" = NOW()
WHERE rr."athleteRaceId" IS NULL
  AND rr."goalId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "athlete_races" AS ar
    WHERE ar."id" = rr."goalId"
      AND ar."athleteId" = rr."athleteId"
      AND ar."raceRegistryId" = rr."raceRegistryId"
  );

-- 4. Fail if result rows still reference goals that cannot map to a race.
DO $$
DECLARE
  unresolved_results INTEGER;
BEGIN
  SELECT COUNT(*) INTO unresolved_results
  FROM "athlete_race_results" AS rr
  WHERE rr."goalId" IS NOT NULL
    AND rr."athleteRaceId" IS NULL;

  IF unresolved_results > 0 THEN
    RAISE EXCEPTION
      'Migration blocked: % athlete_race_results rows have goalId but no resolvable athleteRaceId',
      unresolved_results;
  END IF;
END $$;

-- 5. Drop legacy goal FKs and columns.
ALTER TABLE "training_plans" DROP CONSTRAINT IF EXISTS "training_plans_athleteGoalId_fkey";
DROP INDEX IF EXISTS "training_plans_athleteGoalId_idx";
ALTER TABLE "training_plans" DROP COLUMN IF EXISTS "athleteGoalId";

ALTER TABLE "athlete_race_results" DROP CONSTRAINT IF EXISTS "athlete_race_results_goalId_fkey";
DROP INDEX IF EXISTS "athlete_race_results_goalId_idx";
ALTER TABLE "athlete_race_results" DROP CONSTRAINT IF EXISTS "athlete_race_results_goalId_key";
ALTER TABLE "athlete_race_results" DROP COLUMN IF EXISTS "goalId";

DROP TABLE IF EXISTS "athlete_goals";
