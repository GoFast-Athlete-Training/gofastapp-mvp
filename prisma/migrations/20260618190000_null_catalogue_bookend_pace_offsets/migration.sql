-- Open warmup/cooldown pacing: keep bookend miles, clear pace offsets so segments stay OPEN.
UPDATE "workout_catalogue"
SET
  "warmupPaceOffsetSecPerMile" = NULL,
  "cooldownPaceOffsetSecPerMile" = NULL
WHERE
  "warmupPaceOffsetSecPerMile" IS NOT NULL
  OR "cooldownPaceOffsetSecPerMile" IS NOT NULL;
