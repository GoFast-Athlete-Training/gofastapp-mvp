-- Split persisted plan schedule into build / taper / race-week JSON slices.
ALTER TABLE "training_plans" ADD COLUMN "planScheduleBuild" JSONB;
ALTER TABLE "training_plans" ADD COLUMN "planScheduleTaper" JSONB;
ALTER TABLE "training_plans" ADD COLUMN "planScheduleRaceWeek" JSONB;
