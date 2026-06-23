-- CreateEnum
CREATE TYPE "TimePreference" AS ENUM ('Morning', 'Afternoon', 'Evening');

-- AlterTable: Add run distance and time preference fields
ALTER TABLE "run_crews" ADD COLUMN IF NOT EXISTS "typicalRunMiles" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longRunMilesMin" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longRunMilesMax" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "timePreference" "TimePreference"[] DEFAULT ARRAY[]::"TimePreference"[];

