-- Rename plan canonical schedule JSON column; training_plans.planSchedule holds structured week arrays.
ALTER TABLE "training_plans" RENAME COLUMN "planWeeks" TO "planSchedule";

-- Snapshot fields computed when the plan schedule is generated
ALTER TABLE "training_plans" ADD COLUMN "peakWeekNumber" INTEGER;
ALTER TABLE "training_plans" ADD COLUMN "taperStartWeekNumber" INTEGER;
ALTER TABLE "training_plans" ADD COLUMN "calculatedLongRunMax" DOUBLE PRECISION;
