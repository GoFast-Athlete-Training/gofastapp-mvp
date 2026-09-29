-- Rename city_runs.partnerBrandId → runBrandId (Sponsor Manage brandId snap)
ALTER TABLE "city_runs" RENAME COLUMN "partnerBrandId" TO "runBrandId";

ALTER INDEX "city_runs_partnerBrandId_idx" RENAME TO "city_runs_runBrandId_idx";

ALTER TABLE "city_runs" RENAME CONSTRAINT "city_runs_partnerBrandId_fkey" TO "city_runs_runBrandId_fkey";
