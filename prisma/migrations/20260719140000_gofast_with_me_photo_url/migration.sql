ALTER TABLE "gofast_with_me" ADD COLUMN "gofastWithMePhotoUrl" TEXT;

-- Backfill from legacy profile hero where GoFastWithMe photo is empty
UPDATE "gofast_with_me" gwm
SET "gofastWithMePhotoUrl" = a."myBestRunPhotoURL"
FROM "Athlete" a
WHERE gwm."athleteId" = a.id
  AND gwm."gofastWithMePhotoUrl" IS NULL
  AND a."myBestRunPhotoURL" IS NOT NULL
  AND trim(a."myBestRunPhotoURL") <> '';
