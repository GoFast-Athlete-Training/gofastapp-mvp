-- Athlete.clubManagerState — durable first-ack for Club Manager welcome (not membership authority).

ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "clubManagerState" JSONB;
