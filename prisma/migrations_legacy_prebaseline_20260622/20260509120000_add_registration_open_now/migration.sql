-- Staff-flag: registration is already open (no specific "opens on" date).
ALTER TABLE "race_registry" ADD COLUMN IF NOT EXISTS "registrationOpenNow" BOOLEAN NOT NULL DEFAULT false;
