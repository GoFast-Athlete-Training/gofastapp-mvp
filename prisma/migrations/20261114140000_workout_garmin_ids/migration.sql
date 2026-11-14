-- Garmin workout id so a resend updates the same watch workout instead of creating another.
ALTER TABLE "planned_workouts" ADD COLUMN "garminWorkoutId" INTEGER;
ALTER TABLE "planned_workouts" ADD COLUMN "garminScheduleId" INTEGER;

ALTER TABLE "workouts" ADD COLUMN "garminWorkoutId" INTEGER;
ALTER TABLE "workouts" ADD COLUMN "garminScheduleId" INTEGER;
