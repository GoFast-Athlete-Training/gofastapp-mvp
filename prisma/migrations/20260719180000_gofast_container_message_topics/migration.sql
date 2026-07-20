-- Add topical feed support to GoFastWithMe member hub messages
ALTER TABLE "gofast_container_messages" ADD COLUMN "topic" TEXT NOT NULL DEFAULT 'chatter';
ALTER TABLE "gofast_container_messages" ADD COLUMN "routeId" TEXT;

CREATE INDEX "gofast_container_messages_containerAthleteId_topic_createdAt_idx"
  ON "gofast_container_messages"("containerAthleteId", "topic", "createdAt");

ALTER TABLE "gofast_container_messages"
  ADD CONSTRAINT "gofast_container_messages_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
