-- Normalize Washington/DC city data to canonical "DC"
-- Goal:
-- 1) Convert city values like "Washington" / "Washington DC" / "District of Columbia" to "DC"
-- 2) Set state to NULL for those normalized city values
-- 3) Normalize citySlug to "dc" for affected runs

BEGIN;

-- 1) city_runs meet-up location normalization
UPDATE "city_runs"
SET
  "meetUpCity" = 'DC',
  "meetUpState" = NULL,
  "updatedAt" = NOW()
WHERE
  "meetUpCity" IS NOT NULL
  AND (
    lower(trim("meetUpCity")) IN ('washington', 'washington dc', 'washington, dc', 'district of columbia', 'dc')
    OR (
      lower(trim(COALESCE("meetUpState", ''))) IN ('dc', 'district of columbia')
      AND lower(trim("meetUpCity")) = 'washington'
    )
  );

-- 2) city_runs end location normalization
UPDATE "city_runs"
SET
  "endCity" = 'DC',
  "endState" = NULL,
  "updatedAt" = NOW()
WHERE
  "endCity" IS NOT NULL
  AND (
    lower(trim("endCity")) IN ('washington', 'washington dc', 'washington, dc', 'district of columbia', 'dc')
    OR (
      lower(trim(COALESCE("endState", ''))) IN ('dc', 'district of columbia')
      AND lower(trim("endCity")) = 'washington'
    )
  );

-- 3) city_runs routing normalization
UPDATE "city_runs"
SET
  "citySlug" = 'dc',
  "updatedAt" = NOW()
WHERE lower(trim("citySlug")) IN ('washington', 'washington-dc', 'district-of-columbia');

-- 4) run_clubs city normalization
UPDATE "run_clubs"
SET
  "city" = 'DC',
  "updatedAt" = NOW()
WHERE
  "city" IS NOT NULL
  AND lower(trim("city")) IN ('washington', 'washington dc', 'washington, dc', 'district of columbia', 'dc');

-- 5) canonicalize "cities" lookup row
DO $$
DECLARE
  dc_row_id TEXT;
  washington_row_id TEXT;
BEGIN
  SELECT id INTO dc_row_id
  FROM "cities"
  WHERE lower(slug) = 'dc'
  LIMIT 1;

  SELECT id INTO washington_row_id
  FROM "cities"
  WHERE lower(slug) IN ('washington', 'washington-dc', 'district-of-columbia')
  LIMIT 1;

  IF washington_row_id IS NOT NULL THEN
    IF dc_row_id IS NOT NULL THEN
      -- Keep existing canonical dc row, remove redundant washington alias row
      DELETE FROM "cities" WHERE id = washington_row_id;
    ELSE
      UPDATE "cities"
      SET
        "slug" = 'dc',
        "name" = 'DC',
        "state" = NULL,
        "updatedAt" = NOW()
      WHERE id = washington_row_id;
    END IF;
  END IF;
END $$;

COMMIT;
