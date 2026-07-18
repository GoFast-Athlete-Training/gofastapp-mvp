-- GoFast With Me refactor: rename gofast_pages, drop CMS tables, add identity fields

DROP TABLE IF EXISTS "gofast_page_routes";
DROP TABLE IF EXISTS "athlete_tips";

ALTER TABLE "gofast_pages" RENAME TO "gofast_with_me";
ALTER TABLE "gofast_with_me" RENAME COLUMN "welcomeOpener" TO "welcome";

ALTER TABLE "gofast_with_me" ADD COLUMN "slugUsesHandle" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "gofast_with_me" ADD COLUMN "gofastWithMeBio" TEXT;
ALTER TABLE "gofast_with_me" ADD COLUMN "whatYoullSeeHere" TEXT;
ALTER TABLE "gofast_with_me" ADD COLUMN "sportFocus" TEXT;
ALTER TABLE "gofast_with_me" ADD COLUMN "modelFocus" TEXT;
ALTER TABLE "gofast_with_me" ADD COLUMN "myAchievements" TEXT;
