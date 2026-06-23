-- Optional hero/logo URL for race cards (editorial or external CDN).
ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
