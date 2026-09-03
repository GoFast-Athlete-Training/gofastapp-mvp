-- Persist workout.complete rows for in-app notification inbox (mirrors reminder stamp pattern)

ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "appnotificationCompleteSentAt" TIMESTAMP(3);
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "appnotificationCompleteDeliveredAt" TIMESTAMP(3);
