-- Civil calendar day stamps for plans and races. DateTime columns remain sort anchors.

ALTER TABLE "race_registry" ADD COLUMN "raceDay" TEXT;
UPDATE "race_registry"
SET "raceDay" = to_char("raceDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "raceDay" IS NULL;
CREATE INDEX "race_registry_raceDay_idx" ON "race_registry"("raceDay");

ALTER TABLE "athlete_races" ADD COLUMN "raceDay" TEXT;
UPDATE "athlete_races"
SET "raceDay" = to_char("raceDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "raceDay" IS NULL;
CREATE INDEX "athlete_races_raceDay_idx" ON "athlete_races"("raceDay");

ALTER TABLE "training_plans" ADD COLUMN "startDay" TEXT;
UPDATE "training_plans"
SET "startDay" = to_char("startDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "startDay" IS NULL;
CREATE INDEX "training_plans_startDay_idx" ON "training_plans"("startDay");

ALTER TABLE "planned_workouts" ADD COLUMN "planDay" TEXT;
UPDATE "planned_workouts"
SET "planDay" = to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "planDay" IS NULL;
CREATE INDEX "planned_workouts_planId_planDay_idx" ON "planned_workouts"("planId", "planDay");

ALTER TABLE "workouts" ADD COLUMN "planDay" TEXT;
UPDATE "workouts"
SET "planDay" = to_char("date" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "planDay" IS NULL AND "date" IS NOT NULL;

ALTER TABLE "race_plans" ADD COLUMN "raceDay" TEXT;
UPDATE "race_plans"
SET "raceDay" = to_char("raceDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "raceDay" IS NULL;

ALTER TABLE "race_triggers" ADD COLUMN "raceDay" TEXT;
ALTER TABLE "race_triggers" ADD COLUMN "weekOutDay" TEXT;
ALTER TABLE "race_triggers" ADD COLUMN "reminderDay" TEXT;

UPDATE "race_triggers"
SET
  "raceDay" = to_char("raceDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  "weekOutDay" = to_char("weekOutDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  "reminderDay" = to_char("reminderDate" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "raceDay" IS NULL;

CREATE INDEX "race_triggers_raceDay_idx" ON "race_triggers"("raceDay");
CREATE INDEX "race_triggers_weekOutDay_idx" ON "race_triggers"("weekOutDay");
CREATE INDEX "race_triggers_reminderDay_idx" ON "race_triggers"("reminderDay");
