-- CreateTable
CREATE TABLE "athlete_product_roles" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" "AthleteRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_product_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_product_roles_athleteId_role_key" ON "athlete_product_roles"("athleteId", "role");

-- CreateIndex
CREATE INDEX "athlete_product_roles_role_idx" ON "athlete_product_roles"("role");

-- AddForeignKey
ALTER TABLE "athlete_product_roles" ADD CONSTRAINT "athlete_product_roles_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill CLUB_LEADER product role from legacy flat Athlete.role
INSERT INTO "athlete_product_roles" ("id", "athleteId", "role", "createdAt")
SELECT
  'apr_' || substr(md5("id" || 'CLUB_LEADER'), 1, 24),
  "id",
  'CLUB_LEADER'::"AthleteRole",
  NOW()
FROM "Athlete"
WHERE "role" = 'CLUB_LEADER'::"AthleteRole"
ON CONFLICT ("athleteId", "role") DO NOTHING;

-- Backfill AMBASSADOR product role from legacy flat Athlete.role
INSERT INTO "athlete_product_roles" ("id", "athleteId", "role", "createdAt")
SELECT
  'apr_' || substr(md5("id" || 'AMBASSADOR'), 1, 24),
  "id",
  'AMBASSADOR'::"AthleteRole",
  NOW()
FROM "Athlete"
WHERE "role" = 'AMBASSADOR'::"AthleteRole"
ON CONFLICT ("athleteId", "role") DO NOTHING;
