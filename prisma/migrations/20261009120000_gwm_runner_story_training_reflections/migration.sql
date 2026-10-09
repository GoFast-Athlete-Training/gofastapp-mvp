-- Full runner story on GoFast With Me landing
ALTER TABLE "gofast_with_me" ADD COLUMN IF NOT EXISTS "runnerStory" TEXT;

-- Training reflections: optional activity link (was 1:1 required on activity)
ALTER TABLE "athlete_activity_posts" DROP CONSTRAINT IF EXISTS "athlete_activity_posts_activityId_key";
ALTER TABLE "athlete_activity_posts" ALTER COLUMN "activityId" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "athlete_activity_posts_activityId_key"
  ON "athlete_activity_posts"("activityId")
  WHERE "activityId" IS NOT NULL;
