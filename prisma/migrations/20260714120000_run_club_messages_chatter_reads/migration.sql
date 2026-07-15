-- Club-level chatter + Universal Chatter read cursors

CREATE TABLE "run_club_messages" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "linkedRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chatter_channel_reads" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatter_channel_reads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "run_club_messages_runClubId_createdAt_idx" ON "run_club_messages"("runClubId", "createdAt");
CREATE INDEX "run_club_messages_athleteId_idx" ON "run_club_messages"("athleteId");
CREATE INDEX "run_club_messages_linkedRunId_idx" ON "run_club_messages"("linkedRunId");

CREATE UNIQUE INDEX "chatter_channel_reads_athleteId_channelType_channelId_key" ON "chatter_channel_reads"("athleteId", "channelType", "channelId");
CREATE INDEX "chatter_channel_reads_athleteId_idx" ON "chatter_channel_reads"("athleteId");

ALTER TABLE "run_club_messages" ADD CONSTRAINT "run_club_messages_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_club_messages" ADD CONSTRAINT "run_club_messages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_club_messages" ADD CONSTRAINT "run_club_messages_linkedRunId_fkey" FOREIGN KEY ("linkedRunId") REFERENCES "city_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chatter_channel_reads" ADD CONSTRAINT "chatter_channel_reads_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
