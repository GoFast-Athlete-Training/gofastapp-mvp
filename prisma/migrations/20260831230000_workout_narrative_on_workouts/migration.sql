-- Move host session narrative from city_runs to workouts (workout-owned field).
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "workoutNarrative" TEXT;

UPDATE "workouts" w
SET "workoutNarrative" = c."workoutNarrative"
FROM "city_runs" c
WHERE c."workoutId" = w."id"
  AND c."workoutNarrative" IS NOT NULL
  AND TRIM(c."workoutNarrative") <> ''
  AND (w."workoutNarrative" IS NULL OR TRIM(w."workoutNarrative") = '');

ALTER TABLE "city_runs" DROP COLUMN IF EXISTS "workoutNarrative";
