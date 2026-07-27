-- Backfill advertising candidates for container-enabled athletes (runs once on deploy).
INSERT INTO "advertising_candidates" (
    "id",
    "code",
    "candidateType",
    "athleteId",
    "status",
    "publicSlugSnapshot",
    "displayLabel",
    "photoUrl",
    "eligibleAt",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    'GFA-' || upper(substr(replace(a."id", '-', ''), 1, 8)),
    'ATHLETE'::"AdvertisingCandidateType",
    a."id",
    'ELIGIBLE'::"AdvertisingCandidateStatus",
    gwm."gofastSlugSnapshot",
    COALESCE(
        NULLIF(trim(concat_ws(' ', a."firstName", a."lastName")), ''),
        a."gofastHandle",
        'GoFast Athlete'
    ),
    a."photoURL",
    NOW(),
    NOW(),
    NOW()
FROM "Athlete" a
LEFT JOIN "gofast_with_me" gwm ON gwm."athleteId" = a."id"
WHERE a."isGoFastContainer" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "advertising_candidates" ac
    WHERE ac."athleteId" = a."id"
  );
