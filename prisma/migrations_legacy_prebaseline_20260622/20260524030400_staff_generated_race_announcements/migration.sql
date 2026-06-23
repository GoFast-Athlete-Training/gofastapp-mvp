ALTER TABLE "race_announcements"
  ADD COLUMN IF NOT EXISTS "staffGeneratedId" TEXT;

ALTER TABLE "race_announcements"
  ALTER COLUMN "authorId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "race_announcements_staffGeneratedId_idx"
  ON "race_announcements"("staffGeneratedId");
