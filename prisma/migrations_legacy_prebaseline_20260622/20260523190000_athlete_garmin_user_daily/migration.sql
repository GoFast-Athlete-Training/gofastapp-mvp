-- Store latest Garmin daily summary (body battery, etc.) on athlete
ALTER TABLE "Athlete" ADD COLUMN "garmin_user_daily" JSONB;
