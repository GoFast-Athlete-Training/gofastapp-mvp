-- Course guide cards (landmarks, water, elevation) from Race Manage / prodpush.
ALTER TABLE "race_registry_course_segments" ADD COLUMN IF NOT EXISTS "guideLandmarks" TEXT;
ALTER TABLE "race_registry_course_segments" ADD COLUMN IF NOT EXISTS "guideWater" TEXT;
ALTER TABLE "race_registry_course_segments" ADD COLUMN IF NOT EXISTS "guideElevation" TEXT;
