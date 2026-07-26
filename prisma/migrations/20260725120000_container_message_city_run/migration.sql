-- Attach optional joinable run to container feed posts
ALTER TABLE "gofast_container_messages" ADD COLUMN "cityRunId" TEXT;

ALTER TABLE "gofast_container_messages" ADD CONSTRAINT "gofast_container_messages_cityRunId_fkey" FOREIGN KEY ("cityRunId") REFERENCES "city_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "gofast_container_messages_cityRunId_idx" ON "gofast_container_messages"("cityRunId");
