-- Workout-level JSON blobs: prescription snapshots + completed activity payloads + computed analysis.

ALTER TABLE "workouts"
  ADD COLUMN "segmentSnapshotJson" JSONB,
  ADD COLUMN "completedActivitySummaryJson" JSONB,
  ADD COLUMN "completedActivityDetailJson" JSONB,
  ADD COLUMN "analysisJson" JSONB;
