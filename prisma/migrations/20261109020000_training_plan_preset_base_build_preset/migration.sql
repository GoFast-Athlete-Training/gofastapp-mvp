ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "baseBuildPresetId" TEXT;

CREATE INDEX IF NOT EXISTS "training_plan_preset_baseBuildPresetId_idx"
  ON "training_plan_preset"("baseBuildPresetId");

ALTER TABLE "training_plan_preset" DROP CONSTRAINT IF EXISTS "training_plan_preset_baseBuildPresetId_fkey";
ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_baseBuildPresetId_fkey"
  FOREIGN KEY ("baseBuildPresetId") REFERENCES "build_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
