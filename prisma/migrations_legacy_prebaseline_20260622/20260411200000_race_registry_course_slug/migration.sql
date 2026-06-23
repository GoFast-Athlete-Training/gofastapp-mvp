-- Public content site /course/[slug] — synced from Company race_courses.slug (prodpush).
ALTER TABLE "race_registry" ADD COLUMN "courseSlug" TEXT;
