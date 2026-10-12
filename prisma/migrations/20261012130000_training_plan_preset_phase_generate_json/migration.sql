-- Mirror Training Manage preset phase payload for athlete generate (no runtime TM hop).
ALTER TABLE "training_plan_preset"
ADD COLUMN IF NOT EXISTS "presetPhaseGenerateJson" JSONB,
ADD COLUMN IF NOT EXISTS "lastSyncedByStaffId" TEXT;
