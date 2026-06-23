-- Training journal entries for Runner OS
CREATE TABLE "run_journal_entries" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "run_journal_entries_athleteId_idx" ON "run_journal_entries"("athleteId");
CREATE INDEX "run_journal_entries_athleteId_date_idx" ON "run_journal_entries"("athleteId", "date");

ALTER TABLE "run_journal_entries" ADD CONSTRAINT "run_journal_entries_athleteId_fkey"
    FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
