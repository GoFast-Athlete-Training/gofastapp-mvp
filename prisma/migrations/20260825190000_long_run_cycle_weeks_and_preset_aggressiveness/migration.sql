-- Rename cycleLen → longRunCycleWeeks (always 4 in product; column kept for existing rows)
ALTER TABLE "training_plan_preset" RENAME COLUMN "cycleLen" TO "longRunCycleWeeks";
ALTER TABLE "athlete_presets" RENAME COLUMN "cycleLen" TO "longRunCycleWeeks";
ALTER TABLE "swim_plan_preset" RENAME COLUMN "cycleLen" TO "longRunCycleWeeks";

-- AI-inferred ambition from athlete free text (not a form picker)
ALTER TABLE "athlete_presets" ADD COLUMN "progressionAggressiveness" "ProgressionAggressiveness";
