-- My run story blog post fields (title + hero photo; runnerStory remains body)
ALTER TABLE "gofast_with_me" ADD COLUMN IF NOT EXISTS "runnerStoryTitle" TEXT;
ALTER TABLE "gofast_with_me" ADD COLUMN IF NOT EXISTS "runnerStoryPhotoUrl" TEXT;
