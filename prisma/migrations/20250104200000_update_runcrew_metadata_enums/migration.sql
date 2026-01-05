-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'both');

-- CreateEnum
CREATE TYPE "State" AS ENUM ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY');

-- AlterTable: Add primary meetup fields
ALTER TABLE "run_crews" ADD COLUMN IF NOT EXISTS "primaryMeetUpPoint" TEXT,
ADD COLUMN IF NOT EXISTS "primaryMeetUpAddress" TEXT,
ADD COLUMN IF NOT EXISTS "primaryMeetUpPlaceId" TEXT,
ADD COLUMN IF NOT EXISTS "primaryMeetUpLat" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "primaryMeetUpLng" DOUBLE PRECISION;

-- AlterTable: Drop old gender column (TEXT[])
ALTER TABLE "run_crews" DROP COLUMN IF EXISTS "gender";

-- AlterTable: Add new gender column (enum)
ALTER TABLE "run_crews" ADD COLUMN IF NOT EXISTS "gender" "Gender";

-- AlterTable: Change state from TEXT to enum
-- First, drop the old column
ALTER TABLE "run_crews" DROP COLUMN IF EXISTS "state";

-- Then add the new enum column
ALTER TABLE "run_crews" ADD COLUMN IF NOT EXISTS "state" "State";

