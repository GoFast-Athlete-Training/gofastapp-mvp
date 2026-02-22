-- city_run_messages: direct replica of run_crew_messages, FK to city_runs instead of run_crews
CREATE TABLE "city_run_messages" (
  "id"        TEXT NOT NULL,
  "runId"     TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "topic"     TEXT NOT NULL DEFAULT 'general',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "city_run_messages_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "city_run_messages"
  ADD CONSTRAINT "city_run_messages_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "city_run_messages"
  ADD CONSTRAINT "city_run_messages_athleteId_fkey"
  FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "city_run_messages_runId_idx" ON "city_run_messages"("runId");
CREATE INDEX "city_run_messages_athleteId_idx" ON "city_run_messages"("athleteId");
CREATE INDEX "city_run_messages_topic_idx" ON "city_run_messages"("topic");
