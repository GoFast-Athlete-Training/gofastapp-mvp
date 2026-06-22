-- Align Strava fields: city_runs.stravaUrl -> stravaEventUrl; remove invalid run_series.stravaUrl.

-- Preserve route-like series URLs on existing dated instances (not on the series row).
UPDATE city_runs cr
SET "stravaMapUrl" = rs."stravaUrl"
FROM run_series rs
WHERE cr."runSeriesId" = rs.id
  AND rs."stravaUrl" IS NOT NULL
  AND btrim(rs."stravaUrl") <> ''
  AND (cr."stravaMapUrl" IS NULL OR btrim(cr."stravaMapUrl") = '')
  AND rs."stravaUrl" ~* 'strava\.com/routes/';

-- Preserve non-route series URLs on existing instances before rename.
UPDATE city_runs cr
SET "stravaUrl" = rs."stravaUrl"
FROM run_series rs
WHERE cr."runSeriesId" = rs.id
  AND rs."stravaUrl" IS NOT NULL
  AND btrim(rs."stravaUrl") <> ''
  AND rs."stravaUrl" !~* 'strava\.com/routes/'
  AND (cr."stravaUrl" IS NULL OR btrim(cr."stravaUrl") = '');

ALTER TABLE "city_runs" RENAME COLUMN "stravaUrl" TO "stravaEventUrl";

ALTER TABLE "run_series" DROP COLUMN IF EXISTS "stravaUrl";
