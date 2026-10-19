-- Full replace per registry: drop global sourceSegmentId uniqueness; order unique per race_registry row.
DROP INDEX IF EXISTS "race_registry_course_segments_sourceSegmentId_key";

ALTER TABLE "race_registry_course_segments"
  ALTER COLUMN "sourceSegmentId" DROP NOT NULL;

CREATE UNIQUE INDEX "race_registry_course_segments_raceRegistryId_order_key"
  ON "race_registry_course_segments"("raceRegistryId", "order");

CREATE INDEX IF NOT EXISTS "race_registry_course_segments_sourceSegmentId_idx"
  ON "race_registry_course_segments"("sourceSegmentId");
