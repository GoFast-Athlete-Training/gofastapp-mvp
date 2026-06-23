-- Remove legacy parallel Garmin "test OAuth" columns. Use GARMIN_CLIENT_ID / GARMIN_CLIENT_SECRET
-- (eval or production app) and standard athlete Garmin token fields only.

ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "garmin_test_access_token";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "garmin_test_user_id";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "garmin_test_linked_email";
ALTER TABLE "Athlete" DROP COLUMN IF EXISTS "garmin_use_test_tokens";
