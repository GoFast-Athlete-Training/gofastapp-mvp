-- workout_catalogue.slug: stable keys for long-run rotation service
-- preset_volume_constraints.cutbackFraction: cutback as fraction of push miles

ALTER TABLE "workout_catalogue" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "workout_catalogue_slug_key" ON "workout_catalogue"("slug");

ALTER TABLE "preset_volume_constraints" ADD COLUMN "cutbackFraction" DOUBLE PRECISION;
