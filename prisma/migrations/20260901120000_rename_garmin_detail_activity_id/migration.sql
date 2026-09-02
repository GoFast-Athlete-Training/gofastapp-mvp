-- Rename matchedActivityId → garminDetailActivityId (Garmin detail ingest pointer, not plan-match)

ALTER TABLE "workouts" RENAME COLUMN "matchedActivityId" TO "garminDetailActivityId";

ALTER TABLE "bike_workout" RENAME COLUMN "matchedActivityId" TO "garminDetailActivityId";
