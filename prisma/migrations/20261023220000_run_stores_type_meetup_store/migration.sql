-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('RUN_STORE', 'COFFEE', 'BAGELS', 'FOOD', 'OTHER');

-- AlterTable
ALTER TABLE "run_stores" ADD COLUMN IF NOT EXISTS "storeType" "StoreType" NOT NULL DEFAULT 'RUN_STORE';

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN IF NOT EXISTS "meetUpStoreId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "city_runs_meetUpStoreId_idx" ON "city_runs"("meetUpStoreId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'city_runs_meetUpStoreId_fkey'
  ) THEN
    ALTER TABLE "city_runs"
      ADD CONSTRAINT "city_runs_meetUpStoreId_fkey"
      FOREIGN KEY ("meetUpStoreId") REFERENCES "run_stores"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
