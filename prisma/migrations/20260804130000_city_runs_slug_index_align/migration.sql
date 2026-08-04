-- Align city_runs slug indexes with schema (remove redundant non-unique index).
DROP INDEX IF EXISTS "city_runs_slug_idx";
DROP INDEX IF EXISTS "city_runs_slug_key";
CREATE UNIQUE INDEX "city_runs_slug_key" ON "city_runs"("slug");
