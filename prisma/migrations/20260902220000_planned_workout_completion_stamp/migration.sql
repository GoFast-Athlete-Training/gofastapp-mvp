-- Stamp planned_workouts when a Garmin workout bolts on (Home/agenda read path).
ALTER TABLE "planned_workouts" ADD COLUMN "workoutId" TEXT;
ALTER TABLE "planned_workouts" ADD COLUMN "workoutCompleted" BOOLEAN NOT NULL DEFAULT false;
