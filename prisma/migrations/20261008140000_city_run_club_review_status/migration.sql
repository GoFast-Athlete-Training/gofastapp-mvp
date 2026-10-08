-- CreateEnum
CREATE TYPE "ClubReviewStatus" AS ENUM ('draft', 'pending_club_review', 'verified');

-- AlterTable
ALTER TABLE "city_runs" ADD COLUMN "clubReviewStatus" "ClubReviewStatus" NOT NULL DEFAULT 'draft';
