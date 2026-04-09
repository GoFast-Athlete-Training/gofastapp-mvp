-- AlterTable
ALTER TABLE "race_registry" ADD COLUMN "packetPickupLocation" TEXT;
ALTER TABLE "race_registry" ADD COLUMN "packetPickupDate" TIMESTAMP(3);
ALTER TABLE "race_registry" ADD COLUMN "packetPickupTime" TEXT;
ALTER TABLE "race_registry" ADD COLUMN "packetPickupDescription" TEXT;
ALTER TABLE "race_registry" ADD COLUMN "spectatorInfo" TEXT;
ALTER TABLE "race_registry" ADD COLUMN "logisticsInfo" TEXT;
ALTER TABLE "race_registry" ADD COLUMN "gearDropInstructions" TEXT;
