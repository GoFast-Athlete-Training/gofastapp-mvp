-- CreateEnum
CREATE TYPE "WorkoutScope" AS ENUM ('ATHLETE', 'GROUP');

-- AlterTable
ALTER TABLE "workouts" ALTER COLUMN "athleteId" DROP NOT NULL;
ALTER TABLE "workouts" ADD COLUMN "runClubId" TEXT;
ALTER TABLE "workouts" ADD COLUMN "createdByStaffId" TEXT;
ALTER TABLE "workouts" ADD COLUMN "scope" "WorkoutScope" NOT NULL DEFAULT 'ATHLETE';

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "run_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "workouts_runClubId_idx" ON "workouts"("runClubId");
CREATE INDEX "workouts_scope_idx" ON "workouts"("scope");
