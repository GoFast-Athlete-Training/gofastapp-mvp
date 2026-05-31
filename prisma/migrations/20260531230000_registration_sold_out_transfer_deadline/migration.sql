-- AlterTable
ALTER TABLE "race_registry" ADD COLUMN "registrationSoldOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "race_registry" ADD COLUMN "transferDeadline" TIMESTAMP(3);
