-- Preset long-run ruleset: replace taper anchor object with taper array + ladder fields.

ALTER TABLE "preset_volume_constraints" ADD COLUMN "taperLongRuns" JSONB;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "baseStartMiles" DOUBLE PRECISION NOT NULL DEFAULT 8;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "ladderStep" DOUBLE PRECISION NOT NULL DEFAULT 2;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "ladderCycleLen" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "preset_volume_constraints" ADD COLUMN "peakEntryMiles" DOUBLE PRECISION NOT NULL DEFAULT 18;

-- Migrate taper miles from legacy object keys "-{taperWeeks}" .. "-1" into ordered array [furthest..closest].
UPDATE "preset_volume_constraints" pv
SET "taperLongRuns" = COALESCE(
  (
    SELECT to_jsonb(array_agg(v ORDER BY ord))
    FROM (
      SELECT
        gs.i AS ord,
        COALESCE(
          (pv."taperLongRunAnchors"->>('-' || (pv."taperWeeks" - gs.i)::text))::double precision,
          0.0
        ) AS v
      FROM generate_series(0, GREATEST(0, pv."taperWeeks" - 1)) AS gs(i)
    ) t
  ),
  '[15, 10, 5]'::jsonb
);

UPDATE "preset_volume_constraints"
SET "taperLongRuns" = '[15, 10, 5]'::jsonb
WHERE "taperLongRuns" IS NULL;

ALTER TABLE "preset_volume_constraints" ALTER COLUMN "taperLongRuns" SET NOT NULL;

ALTER TABLE "preset_volume_constraints" DROP COLUMN "taperLongRunAnchors";
