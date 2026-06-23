-- User run context before coach feedback generation
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "runContextTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "runContextNote" TEXT;
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "runContextUpdatedAt" TIMESTAMP(3);
