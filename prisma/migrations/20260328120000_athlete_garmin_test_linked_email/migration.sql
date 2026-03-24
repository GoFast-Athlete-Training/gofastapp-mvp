-- Optional label for which Garmin test account is linked; test OAuth writes only garmin_test_* fields, never prod.
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "garmin_test_linked_email" TEXT;
