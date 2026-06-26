-- Workout schedule + notification cleanup: unify scheduled_runs onto workouts, drop delivery rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add schedule/share/reminder columns to workouts
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "scheduledStartTimeLabel" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "scheduledMeetupLocation" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "scheduledRouteDescription" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "scheduledStravaRouteUrl" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "scheduledIsTrack" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "scheduledShareSlug" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "appnotificationReminderSentAt" TIMESTAMP(3);
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "appnotificationReminderDeliveredAt" TIMESTAMP(3);
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "appnotificationReminderLastError" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "workouts_scheduledShareSlug_key" ON "workouts"("scheduledShareSlug");

-- 2. Backfill linked scheduled_runs with same UTC date as workout
UPDATE "workouts" w
SET
  "scheduledStartTimeLabel" = sr."startTimeLabel",
  "scheduledMeetupLocation" = sr."meetupLocation",
  "scheduledRouteDescription" = sr."routeDescription",
  "scheduledStravaRouteUrl" = sr."stravaRouteUrl",
  "scheduledIsTrack" = sr."isTrack",
  "scheduledShareSlug" = COALESCE(w."scheduledShareSlug", sr."shareSlug")
FROM "scheduled_runs" sr
WHERE sr."workoutId" = w.id
  AND w.date IS NOT NULL
  AND (w.date AT TIME ZONE 'UTC')::date = (sr.date AT TIME ZONE 'UTC')::date;

-- 3. Backfill linked scheduled_runs where workout date differs or is null — copy as standalone row (no segments)
INSERT INTO "workouts" (
  "id",
  "title",
  "workoutType",
  "athleteId",
  "scope",
  "date",
  "estimatedDistanceInMeters",
  "scheduledStartTimeLabel",
  "scheduledMeetupLocation",
  "scheduledRouteDescription",
  "scheduledStravaRouteUrl",
  "scheduledIsTrack",
  "scheduledShareSlug",
  "evaluationEligibleFlag",
  "createdAt",
  "updatedAt"
)
SELECT
  'c' || encode(gen_random_bytes(12), 'hex'),
  COALESCE(w."title", sr."title"),
  COALESCE(w."workoutType", 'Easy'::"WorkoutType"),
  sr."athleteId",
  COALESCE(w."scope", 'ATHLETE'::"WorkoutScope"),
  sr."date",
  COALESCE(
    CASE WHEN sr."estimatedDistanceMi" IS NOT NULL THEN sr."estimatedDistanceMi" * 1609.34 END,
    w."estimatedDistanceInMeters"
  ),
  sr."startTimeLabel",
  sr."meetupLocation",
  sr."routeDescription",
  sr."stravaRouteUrl",
  sr."isTrack",
  sr."shareSlug",
  false,
  NOW(),
  NOW()
FROM "scheduled_runs" sr
LEFT JOIN "workouts" w ON w.id = sr."workoutId"
WHERE sr."workoutId" IS NOT NULL
  AND (
    w.id IS NULL
    OR w.date IS NULL
    OR (w.date AT TIME ZONE 'UTC')::date <> (sr.date AT TIME ZONE 'UTC')::date
  );

-- 4. Backfill unlinked scheduled_runs as standalone workouts
INSERT INTO "workouts" (
  "id",
  "title",
  "workoutType",
  "athleteId",
  "scope",
  "date",
  "estimatedDistanceInMeters",
  "scheduledStartTimeLabel",
  "scheduledMeetupLocation",
  "scheduledRouteDescription",
  "scheduledStravaRouteUrl",
  "scheduledIsTrack",
  "scheduledShareSlug",
  "evaluationEligibleFlag",
  "createdAt",
  "updatedAt"
)
SELECT
  'c' || encode(gen_random_bytes(12), 'hex'),
  sr."title",
  'Easy'::"WorkoutType",
  sr."athleteId",
  'ATHLETE'::"WorkoutScope",
  sr."date",
  CASE WHEN sr."estimatedDistanceMi" IS NOT NULL THEN sr."estimatedDistanceMi" * 1609.34 END,
  sr."startTimeLabel",
  sr."meetupLocation",
  sr."routeDescription",
  sr."stravaRouteUrl",
  sr."isTrack",
  sr."shareSlug",
  false,
  NOW(),
  NOW()
FROM "scheduled_runs" sr
WHERE sr."workoutId" IS NULL;

-- 5. Drop legacy tables
DROP TABLE IF EXISTS "appnotification_deliveries";
DROP TABLE IF EXISTS "scheduled_runs";
