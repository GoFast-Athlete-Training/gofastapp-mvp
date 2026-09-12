-- CreateTable
CREATE TABLE "app_notification_templates" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_notification_templates_templateKey_key" ON "app_notification_templates"("templateKey");

-- Seed default copy (matches prior hardcoded templates; editable in App Management)
INSERT INTO "app_notification_templates" ("id", "templateKey", "name", "title", "body", "isActive", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'workout.tomorrow', 'Workout tomorrow reminder', 'Tomorrow: {{workoutTitle}}', 'Your {{workoutTitle}} is on your plan for tomorrow — GoFast syncs it to your Garmin watch automatically. Tap to preview.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'scheduledRun.tomorrow', 'Scheduled run tomorrow', 'Your next run is coming', 'Tomorrow: {{runTitle}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'clubRun.today', 'Club run today', '{{clubName}}', '{{body}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'clubRun.tomorrow', 'Club run tomorrow', '{{clubName}}', '{{body}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'club.chatter', 'Club chatter', '{{clubName}}', '{{excerpt}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'crew.announcement', 'Crew announcement', '{{crewName}}', '{{announcementTitle}}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'workout.complete', 'Workout complete congrats', 'Great workout!', '{{workoutTitle}} logged — see your run.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'activity.synced', 'Activity synced', '{{activityTitle}} logged!', '{{activityTitle}} synced from Garmin — nice work!', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'sponsorship.received', 'Sponsorship received', '{{brandName}} is sponsoring you', '{{brandName}} just activated a Brand Partnership on your GoFast profile.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
