-- AlterTable
ALTER TABLE "run_clubs" ADD COLUMN "gofastCity" TEXT,
ADD COLUMN "isMultiSite" BOOLEAN NOT NULL DEFAULT false;
