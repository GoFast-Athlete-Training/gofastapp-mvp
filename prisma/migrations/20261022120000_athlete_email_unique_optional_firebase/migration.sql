-- Normalize emails before unique constraint
UPDATE "Athlete"
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL;

-- Keep one row per email; clear duplicates (oldest id wins)
WITH ranked AS (
  SELECT
    id,
    email,
    ROW_NUMBER() OVER (PARTITION BY email ORDER BY "createdAt" ASC NULLS LAST, id ASC) AS rn
  FROM "Athlete"
  WHERE email IS NOT NULL AND email <> ''
)
UPDATE "Athlete" a
SET email = NULL
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

-- Optional Firebase for name-only public RSVPs (claim on signup)
ALTER TABLE "Athlete" ALTER COLUMN "firebaseId" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Athlete_email_key" ON "Athlete"("email");
