-- Rename citySlug → gofastCity on city_runs
-- citySlug was ambiguous (slug for what?). gofastCity is GoFast's canonical normalized city key.

ALTER TABLE "city_runs" RENAME COLUMN "citySlug" TO "gofastCity";
