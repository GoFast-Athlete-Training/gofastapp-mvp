-- Build-to-peak weekly volume override. Not the self-select band (minWeeklyMiles / maxWeeklyMiles).
ALTER TABLE "training_plan_preset" ADD COLUMN "peakWeeklyVolumeMiles" INTEGER;
