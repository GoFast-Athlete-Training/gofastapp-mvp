-- Athlete-public plan fields on training_plans (slug + visibility separate from coach publish)
ALTER TABLE "training_plans" ADD COLUMN "publicSlug" TEXT;
ALTER TABLE "training_plans" ADD COLUMN "publicVisibility" "PublicTrainingPlanVisibility";
ALTER TABLE "training_plans" ADD COLUMN "publicPublishedAt" TIMESTAMP(3);
ALTER TABLE "training_plans" ADD COLUMN "publicDescription" TEXT;

CREATE UNIQUE INDEX "training_plans_publicSlug_key" ON "training_plans"("publicSlug");

CREATE INDEX "training_plans_publicVisibility_publicPublishedAt_idx" ON "training_plans"("publicVisibility", "publicPublishedAt");
