-- Re-parent: old child table was "run_type_config" per-preset; new parent is "run_type_config" with child "run_type_config_position".

-- 1) Rename old child table (no-op if already only run_type_config_position exists)
DO $body$
BEGIN
  IF to_regclass('public.run_type_config') IS NOT NULL
     AND to_regclass('public.run_type_config_position') IS NULL THEN
    ALTER TABLE "run_type_config" RENAME TO "run_type_config_position";
  END IF;
END
$body$;

-- 2) Child PK was "run_type_config_pkey"; free that name for the new parent
DO $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'run_type_config_position' AND c.conname = 'run_type_config_pkey' AND c.contype = 'p'
  ) THEN
    ALTER TABLE "run_type_config_position" RENAME CONSTRAINT "run_type_config_pkey" TO "run_type_config_position_pkey";
  END IF;
END
$body$;

-- 3) Drop FK to preset, old unique
ALTER TABLE "run_type_config_position" DROP CONSTRAINT IF EXISTS "run_type_config_presetId_fkey";
DROP INDEX IF EXISTS "run_type_config_presetId_cyclePosition_key";

-- 4) Parent table
CREATE TABLE IF NOT EXISTS "run_type_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "run_type_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "run_type_config_name_idx" ON "run_type_config"("name");

-- 5) Preset: optional link
ALTER TABLE "training_plan_preset" ADD COLUMN IF NOT EXISTS "runTypeConfigId" TEXT;

-- 6) Child: new FK
ALTER TABLE "run_type_config_position" ADD COLUMN IF NOT EXISTS "runTypeConfigId" TEXT;

-- 7) Backfill only if legacy "presetId" still present on child
DO $body$
DECLARE
  has_legacy_preset boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'run_type_config_position' AND column_name = 'presetId'
  ) INTO has_legacy_preset;

  IF has_legacy_preset THEN
    CREATE TEMP TABLE _rtc_parent_map ON COMMIT DROP AS
    SELECT gen_random_uuid()::text AS "id", d."pid"::text AS "presetId"
    FROM (SELECT DISTINCT "presetId" AS pid FROM "run_type_config_position" WHERE "presetId" IS NOT NULL) d;

    INSERT INTO "run_type_config" ("id", "name", "description", "createdAt", "updatedAt")
    SELECT m."id", COALESCE(t."title" || ' — rotation', 'Rotation config'), NULL, NOW(), NOW()
    FROM _rtc_parent_map m
    JOIN "training_plan_preset" t ON t."id" = m."presetId";

    UPDATE "run_type_config_position" p
    SET "runTypeConfigId" = m."id"
    FROM _rtc_parent_map m
    WHERE p."presetId" = m."presetId" AND p."runTypeConfigId" IS NULL;

    UPDATE "training_plan_preset" t
    SET "runTypeConfigId" = m."id"
    FROM _rtc_parent_map m
    WHERE t."id" = m."presetId" AND t."runTypeConfigId" IS NULL;
  END IF;
END
$body$;

-- 8) Not-null on child when rows exist
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM "run_type_config_position" LIMIT 1) THEN
    IF EXISTS (SELECT 1 FROM "run_type_config_position" WHERE "runTypeConfigId" IS NULL) THEN
      RAISE EXCEPTION 'run_type_config_position has null runTypeConfigId after backfill';
    END IF;
    ALTER TABLE "run_type_config_position" ALTER COLUMN "runTypeConfigId" SET NOT NULL;
  END IF;
END
$body$;

ALTER TABLE "run_type_config_position" DROP COLUMN IF EXISTS "presetId";

-- 9) Foreign keys
DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'run_type_config_position_runTypeConfigId_fkey') THEN
    ALTER TABLE "run_type_config_position" ADD CONSTRAINT "run_type_config_position_runTypeConfigId_fkey" FOREIGN KEY ("runTypeConfigId") REFERENCES "run_type_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$body$;

CREATE UNIQUE INDEX IF NOT EXISTS "run_type_config_position_runTypeConfigId_cyclePosition_key" ON "run_type_config_position"("runTypeConfigId", "cyclePosition");
CREATE INDEX IF NOT EXISTS "run_type_config_position_runTypeConfigId_idx" ON "run_type_config_position"("runTypeConfigId");

DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_plan_preset_runTypeConfigId_fkey') THEN
    ALTER TABLE "training_plan_preset" ADD CONSTRAINT "training_plan_preset_runTypeConfigId_fkey" FOREIGN KEY ("runTypeConfigId") REFERENCES "run_type_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$body$;

CREATE INDEX IF NOT EXISTS "training_plan_preset_runTypeConfigId_idx" ON "training_plan_preset"("runTypeConfigId");
