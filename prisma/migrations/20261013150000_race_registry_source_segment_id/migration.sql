-- Race Manage segment id (was misnamed companySegmentId).
ALTER TABLE "race_registry_course_segments" RENAME COLUMN "companySegmentId" TO "sourceSegmentId";

ALTER INDEX "race_registry_course_segments_companySegmentId_key"
  RENAME TO "race_registry_course_segments_sourceSegmentId_key";
