-- Staff god-mode on race hub events and messages (mirrors race_announcements.staffGeneratedId).

ALTER TABLE "race_events" ALTER COLUMN "organizerId" DROP NOT NULL;
ALTER TABLE "race_events" ADD COLUMN "staffGeneratedId" TEXT;
CREATE INDEX "race_events_staffGeneratedId_idx" ON "race_events"("staffGeneratedId");

ALTER TABLE "race_messages" ALTER COLUMN "athleteId" DROP NOT NULL;
ALTER TABLE "race_messages" ADD COLUMN "staffGeneratedId" TEXT;
CREATE INDEX "race_messages_staffGeneratedId_idx" ON "race_messages"("staffGeneratedId");
