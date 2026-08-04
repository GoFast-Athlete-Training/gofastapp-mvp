-- city_runs has both @unique and @@index([slug]) in schema.
CREATE INDEX IF NOT EXISTS "city_runs_slug_idx" ON "city_runs"("slug");
