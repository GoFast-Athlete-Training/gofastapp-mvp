-- Idempotent schema hygiene: align legacy constraint/index/column names with schema.prisma.
-- Safe to re-run after a partial apply.

-- training_plan_preset orphan indexes
DROP INDEX IF EXISTS "public"."training_plan_preset_goalId_idx";
DROP INDEX IF EXISTS "public"."training_plan_preset_intervalsConfigId_idx";
DROP INDEX IF EXISTS "public"."training_plan_preset_longRunConfigId_idx";
DROP INDEX IF EXISTS "public"."training_plan_preset_personaId_idx";
DROP INDEX IF EXISTS "public"."training_plan_preset_tempoConfigId_idx";

-- city_run_rsvps
DO $$ BEGIN
  ALTER TABLE "city_run_rsvps" RENAME CONSTRAINT "run_crew_run_rsvps_pkey" TO "city_run_rsvps_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE "city_run_rsvps" DROP COLUMN IF EXISTS "checkedIn";
ALTER TABLE "city_run_rsvps" DROP COLUMN IF EXISTS "completedAt";
ALTER TABLE "city_run_rsvps" DROP COLUMN IF EXISTS "garminActivityId";
ALTER TABLE "city_run_rsvps" DROP COLUMN IF EXISTS "participationStatus";
ALTER TABLE "city_run_rsvps" DROP COLUMN IF EXISTS "rsvpStatus";
ALTER TABLE "city_run_rsvps" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "city_run_rsvps" DROP COLUMN IF EXISTS "verifiedAt";
DO $$ BEGIN
  ALTER TABLE "city_run_rsvps" RENAME CONSTRAINT "run_crew_run_rsvps_athleteId_fkey" TO "city_run_rsvps_athleteId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "city_run_rsvps" RENAME CONSTRAINT "run_crew_run_rsvps_runId_fkey" TO "city_run_rsvps_runId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER INDEX "run_crew_run_rsvps_runId_athleteId_key" RENAME TO "city_run_rsvps_runId_athleteId_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "city_run_rsvps_checkedInAt_idx" ON "city_run_rsvps"("checkedInAt");

-- city_runs
DO $$ BEGIN
  ALTER TABLE "city_runs" RENAME CONSTRAINT "run_crew_runs_pkey" TO "city_runs_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "city_runs" RENAME CONSTRAINT "run_crew_runs_athleteGeneratedId_fkey" TO "city_runs_athleteGeneratedId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "city_runs" RENAME CONSTRAINT "run_crew_runs_runClubId_fkey" TO "city_runs_runClubId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "city_runs" RENAME CONSTRAINT "run_crew_runs_runCrewId_fkey" TO "city_runs_runCrewId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "run_crew_runs_athleteGeneratedId_idx" RENAME TO "city_runs_athleteGeneratedId_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "run_crew_runs_citySlug_idx" RENAME TO "city_runs_citySlug_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "run_crew_runs_date_idx" RENAME TO "city_runs_date_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "run_crew_runs_dayOfWeek_idx" RENAME TO "city_runs_dayOfWeek_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "run_crew_runs_runClubId_idx" RENAME TO "city_runs_runClubId_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "run_crew_runs_runCrewId_idx" RENAME TO "city_runs_runCrewId_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "run_crew_runs_staffGeneratedId_idx" RENAME TO "city_runs_staffGeneratedId_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "city_runs_slug_key" ON "city_runs"("slug");

-- gofast_with_me
DO $$ BEGIN
  ALTER TABLE "gofast_with_me" RENAME CONSTRAINT "gofast_pages_pkey" TO "gofast_with_me_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "gofast_with_me" RENAME CONSTRAINT "gofast_pages_athleteId_fkey" TO "gofast_with_me_athleteId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE "gofast_with_me" ALTER COLUMN "gofastWithMePhotoFocusX" DROP NOT NULL;
ALTER TABLE "gofast_with_me" ALTER COLUMN "gofastWithMePhotoFocusY" DROP NOT NULL;
DO $$ BEGIN ALTER INDEX "gofast_pages_athleteId_key" RENAME TO "gofast_with_me_athleteId_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "gofast_pages_gofastSlugSnapshot_key" RENAME TO "gofast_with_me_gofastSlugSnapshot_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- run_club_leader_claims / run_series
ALTER TABLE "run_club_leader_claims" ALTER COLUMN "membershipRole" SET DEFAULT 'manager';
DO $$ BEGIN
  ALTER TABLE "run_series" RENAME CONSTRAINT "city_run_setups_pkey" TO "run_series_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "run_series" RENAME CONSTRAINT "city_run_setups_runClubId_fkey" TO "run_series_runClubId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- sponsor tables
DO $$ BEGIN
  ALTER TABLE "sponsor_commitments" RENAME CONSTRAINT "advertising_blocks_pkey" TO "sponsor_commitments_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE "sponsor_commitments" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DO $$ BEGIN
  ALTER TABLE "sponsor_commitments" RENAME CONSTRAINT "advertising_blocks_candidateId_fkey" TO "sponsor_commitments_candidateId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "advertising_blocks_candidateId_startsAt_endsAt_idx" RENAME TO "sponsor_commitments_candidateId_startsAt_endsAt_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "advertising_blocks_candidateId_status_idx" RENAME TO "sponsor_commitments_candidateId_status_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "advertising_blocks_status_endsAt_idx" RENAME TO "sponsor_commitments_status_endsAt_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sponsorship_candidates" RENAME CONSTRAINT "advertising_candidates_pkey" TO "sponsorship_candidates_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sponsorship_candidates" RENAME CONSTRAINT "advertising_candidates_athleteId_fkey" TO "sponsorship_candidates_athleteId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "advertising_candidates_athleteId_key" RENAME TO "sponsorship_candidates_athleteId_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "advertising_candidates_candidateType_status_idx" RENAME TO "sponsorship_candidates_candidateType_status_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "advertising_candidates_code_key" RENAME TO "sponsorship_candidates_code_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "advertising_candidates_status_idx" RENAME TO "sponsorship_candidates_status_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- training_preferences / workouts
ALTER TABLE "training_preferences" ALTER COLUMN "preferredDays" DROP DEFAULT;
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "coolDownMiles";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "effortModifier";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "effortType";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "mainSetMiles";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "totalMiles";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "warmUpMiles";
ALTER TABLE "workouts" DROP COLUMN IF EXISTS "workoutFormat";

-- orphan prebaseline table
DROP TABLE IF EXISTS "public"."_prisma_migrations_prebaseline_20260622";

-- legacy enums (only if unused)
DROP TYPE IF EXISTS "public"."ParticipationStatus";
DROP TYPE IF EXISTS "public"."RSVPStatus";

-- indexes
CREATE INDEX IF NOT EXISTS "athlete_race_results_goalId_idx" ON "athlete_race_results"("goalId");

-- gofast container index renames
DO $$ BEGIN ALTER INDEX "gofast_container_memberships_containerAthleteId_memberAthleteId" RENAME TO "gofast_container_memberships_containerAthleteId_memberAthle_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "gofast_container_messages_containerAthleteId_topic_createdAt_id" RENAME TO "gofast_container_messages_containerAthleteId_topic_createdA_idx"; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "swim_rotation_config_position_swimRotationConfigId_cyclePositio" RENAME TO "swim_rotation_config_position_swimRotationConfigId_cyclePos_key"; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- tri_workout_leg FK refresh
ALTER TABLE "public"."tri_workout_leg" DROP CONSTRAINT IF EXISTS "tri_workout_leg_bikeWorkoutId_fkey";
ALTER TABLE "public"."tri_workout_leg" DROP CONSTRAINT IF EXISTS "tri_workout_leg_runWorkoutId_fkey";
ALTER TABLE "public"."tri_workout_leg" DROP CONSTRAINT IF EXISTS "tri_workout_leg_swimWorkoutId_fkey";
DO $$ BEGIN
  ALTER TABLE "tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_bikeWorkoutId_fkey" FOREIGN KEY ("bikeWorkoutId") REFERENCES "bike_workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_swimWorkoutId_fkey" FOREIGN KEY ("swimWorkoutId") REFERENCES "swim_workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_runWorkoutId_fkey" FOREIGN KEY ("runWorkoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
