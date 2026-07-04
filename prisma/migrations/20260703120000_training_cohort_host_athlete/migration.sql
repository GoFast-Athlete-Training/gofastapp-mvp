-- Athlete-hosted training cohorts (group training invite surface)
ALTER TABLE "training_cohorts" ADD COLUMN "hostAthleteId" TEXT;

CREATE INDEX "training_cohorts_hostAthleteId_idx" ON "training_cohorts"("hostAthleteId");

ALTER TABLE "training_cohorts" ADD CONSTRAINT "training_cohorts_hostAthleteId_fkey"
  FOREIGN KEY ("hostAthleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
