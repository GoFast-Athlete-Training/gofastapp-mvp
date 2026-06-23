-- Track when athlete last opened the app (bootstrap via /api/athlete/me or /api/athlete/create)
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
