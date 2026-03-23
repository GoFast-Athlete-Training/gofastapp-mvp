-- Route/course Strava lives on `routes`; workouts no longer persist stravaUrl.
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "stravaUrl";
