-- AlterTable
ALTER TABLE "workouts" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "workouts_slug_key" ON "workouts"("slug");
