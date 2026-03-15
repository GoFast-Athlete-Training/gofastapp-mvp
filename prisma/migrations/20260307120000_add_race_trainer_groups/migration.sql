-- CreateEnum
CREATE TYPE "RaceTrainerRole" AS ENUM ('MEMBER', 'PACER', 'COACH', 'ADMIN');

-- CreateTable: race_trainer_groups
CREATE TABLE "race_trainer_groups" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "companyRaceId" TEXT,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "joinCode" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_trainer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable: race_trainer_members
CREATE TABLE "race_trainer_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RaceTrainerRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_trainer_members_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "race_trainer_groups_handle_key" ON "race_trainer_groups"("handle");
CREATE UNIQUE INDEX "race_trainer_groups_joinCode_key" ON "race_trainer_groups"("joinCode");
CREATE UNIQUE INDEX "race_trainer_members_groupId_userId_key" ON "race_trainer_members"("groupId", "userId");

-- CreateIndex
CREATE INDEX "race_trainer_groups_raceId_idx" ON "race_trainer_groups"("raceId");
CREATE INDEX "race_trainer_groups_companyRaceId_idx" ON "race_trainer_groups"("companyRaceId");
CREATE INDEX "race_trainer_members_groupId_idx" ON "race_trainer_members"("groupId");
CREATE INDEX "race_trainer_members_userId_idx" ON "race_trainer_members"("userId");

-- AddForeignKey
ALTER TABLE "race_trainer_groups" ADD CONSTRAINT "race_trainer_groups_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "race_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "race_trainer_members" ADD CONSTRAINT "race_trainer_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "race_trainer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
