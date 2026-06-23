-- AlterTable
ALTER TABLE "preset_volume_constraints" ADD COLUMN     "cyclePeakPool" DOUBLE PRECISION;
ALTER TABLE "preset_volume_constraints" ADD COLUMN     "cyclePoolBuildCoef" DOUBLE PRECISION NOT NULL DEFAULT 1.12;
ALTER TABLE "preset_volume_constraints" ADD COLUMN     "cyclePoolTaperCoef" DOUBLE PRECISION NOT NULL DEFAULT 0.85;
