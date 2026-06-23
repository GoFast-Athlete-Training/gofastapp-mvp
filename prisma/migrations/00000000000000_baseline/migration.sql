-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AthleteRole" AS ENUM ('USER', 'CLUB_LEADER', 'AMBASSADOR');

-- CreateEnum
CREATE TYPE "public"."BrandType" AS ENUM ('SHOE', 'APPAREL', 'RUN_STORE_CHAIN', 'GEAR', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CityRunType" AS ENUM ('CLUB', 'INDIVIDUAL', 'RACE_SHAKEOUT', 'RUN_CREW', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CoachReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "public"."EffortType" AS ENUM ('Easy', 'MarathonEffort', 'HalfMarathonEffort', 'TenKEffort', 'FiveKEffort', 'RPE');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'both');

-- CreateEnum
CREATE TYPE "public"."ParticipationStatus" AS ENUM ('RSVPED', 'CHECKED_IN', 'VERIFIED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."Purpose" AS ENUM ('Training', 'Fun', 'Social');

-- CreateEnum
CREATE TYPE "public"."RSVPStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

-- CreateEnum
CREATE TYPE "public"."RaceMemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."RouteLighting" AS ENUM ('FULLY_LIT', 'PARTIALLY_LIT', 'UNLIT');

-- CreateEnum
CREATE TYPE "public"."RouteShade" AS ENUM ('FULL_SHADE', 'PARTIAL_SHADE', 'EXPOSED');

-- CreateEnum
CREATE TYPE "public"."RouteShape" AS ENUM ('LOOP', 'OUT_AND_BACK', 'POINT_TO_POINT');

-- CreateEnum
CREATE TYPE "public"."RouteSurface" AS ENUM ('PAVED', 'TRAIL', 'GRAVEL', 'MIXED');

-- CreateEnum
CREATE TYPE "public"."RouteTerrain" AS ENUM ('FLAT', 'ROLLING', 'HILLY', 'MIXED');

-- CreateEnum
CREATE TYPE "public"."RouteTraffic" AS ENUM ('NO_CARS', 'LOW_TRAFFIC', 'MODERATE_TRAFFIC', 'HIGH_TRAFFIC');

-- CreateEnum
CREATE TYPE "public"."RouteVibe" AS ENUM ('SPEED_WORK', 'TEMPO', 'LONG_RUN', 'RECOVERY', 'SOCIAL', 'BEGINNER_FRIENDLY');

-- CreateEnum
CREATE TYPE "public"."RunCrewRole" AS ENUM ('member', 'admin', 'manager');

-- CreateEnum
CREATE TYPE "public"."RunWorkflowStatus" AS ENUM ('DEVELOP', 'PENDING', 'SUBMITTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "public"."State" AS ENUM ('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY');

-- CreateEnum
CREATE TYPE "public"."TimePreference" AS ENUM ('Morning', 'Afternoon', 'Evening');

-- CreateEnum
CREATE TYPE "public"."TrainingCohortRole" AS ENUM ('MEMBER', 'PACER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."TrainingCohortStatus" AS ENUM ('DRAFT', 'OPEN', 'ACTIVE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "public"."TrainingForDistance" AS ENUM ('FiveK', 'TenK', 'HalfMarathon', 'Marathon', 'Ultra');

-- CreateEnum
CREATE TYPE "public"."TrainingPlanLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED', 'OLD_PLAN_UNUSED');

-- CreateEnum
CREATE TYPE "public"."TriSport" AS ENUM ('Swim', 'Bike', 'Run');

-- CreateEnum
CREATE TYPE "public"."WorkoutFormat" AS ENUM ('Continuous', 'WarmupMainCooldown', 'Progression', 'IntervalsUnstructured');

-- CreateEnum
CREATE TYPE "public"."WorkoutScope" AS ENUM ('ATHLETE', 'GROUP');

-- CreateEnum
CREATE TYPE "public"."WorkoutType" AS ENUM ('Easy', 'Tempo', 'Intervals', 'LongRun', 'Race');

-- CreateTable
CREATE TABLE "public"."Athlete" (
    "id" TEXT NOT NULL,
    "firebaseId" TEXT NOT NULL,
    "email" TEXT,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "gofastHandle" TEXT,
    "photoURL" TEXT,
    "phoneNumber" TEXT,
    "birthday" TIMESTAMP(3),
    "gender" TEXT,
    "city" TEXT,
    "state" TEXT,
    "primarySport" TEXT,
    "bio" TEXT,
    "instagram" TEXT,
    "garmin_user_id" TEXT,
    "garmin_access_token" TEXT,
    "garmin_refresh_token" TEXT,
    "garmin_expires_in" INTEGER,
    "garmin_scope" TEXT,
    "garmin_connected_at" TIMESTAMP(3),
    "garmin_last_sync_at" TIMESTAMP(3),
    "garmin_is_connected" BOOLEAN NOT NULL DEFAULT false,
    "garmin_disconnected_at" TIMESTAMP(3),
    "garmin_permissions" JSONB,
    "garmin_user_profile" JSONB,
    "garmin_user_sleep" JSONB,
    "garmin_user_preferences" JSONB,
    "strava_id" INTEGER,
    "strava_access_token" TEXT,
    "strava_refresh_token" TEXT,
    "strava_expires_at" INTEGER,
    "fiveKPace" TEXT,
    "weeklyMileage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "public"."AthleteRole" NOT NULL DEFAULT 'USER',
    "runClubId" TEXT,
    "myBestRunPhotoURL" TEXT,
    "isGoFastContainer" BOOLEAN NOT NULL DEFAULT false,
    "ftpWatts" INTEGER,
    "thresholdPace" TEXT,
    "aerobicCeilingBpm" INTEGER,
    "garmin_user_daily" JSONB,
    "primaryGoalNameSnapshot" TEXT,
    "primaryGoalTimeSnapshot" TEXT,
    "primaryGoalTargetByDateSnapshot" TIMESTAMP(3),
    "primaryGoalRaceNameSnapshot" TEXT,
    "primaryRaceRegistryIdSnapshot" TEXT,
    "primaryRaceSlugSnapshot" TEXT,
    "primaryRaceNameSnapshot" TEXT,
    "primaryRaceDateSnapshot" TIMESTAMP(3),
    "primaryRaceDistanceLabelSnapshot" TEXT,
    "primaryRaceCitySnapshot" TEXT,
    "primaryRaceStateSnapshot" TEXT,
    "longRunCapabilityMiles" DOUBLE PRECISION,
    "longRunCapabilityPaceSecPerMile" INTEGER,
    "longRunCapabilityDate" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "avgWeeklyMilesSnapshot" DOUBLE PRECISION,
    "mileageSnapshotUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_prisma_migrations_prebaseline_20260622" (
    "id" VARCHAR(36),
    "checksum" VARCHAR(64),
    "finished_at" TIMESTAMPTZ(6),
    "migration_name" VARCHAR(255),
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "applied_steps_count" INTEGER
);

-- CreateTable
CREATE TABLE "public"."ambassador_credits" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "cityRunRsvpId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ambassador_payouts" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "companyPayoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambassador_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."appnotification_deliveries" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "deeplink" TEXT,
    "payload" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appnotification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."athlete_activities" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "sourceActivityId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'garmin',
    "activityType" TEXT,
    "activityName" TEXT,
    "startTime" TIMESTAMP(3),
    "duration" INTEGER,
    "distance" DOUBLE PRECISION,
    "calories" INTEGER,
    "averageSpeed" DOUBLE PRECISION,
    "averageHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "elevationGain" DOUBLE PRECISION,
    "steps" INTEGER,
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "endLatitude" DOUBLE PRECISION,
    "endLongitude" DOUBLE PRECISION,
    "summaryPolyline" TEXT,
    "summaryData" JSONB,
    "detailData" JSONB,
    "hydratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ingestionStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "averagePower" INTEGER,

    CONSTRAINT "athlete_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."athlete_appnotification_devices" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT,
    "deviceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_appnotification_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."athlete_goals" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "distance" TEXT NOT NULL,
    "goalTime" TEXT,
    "goalRacePace" INTEGER,
    "goalPace5K" INTEGER,
    "targetByDate" TIMESTAMP(3) NOT NULL,
    "raceRegistryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "whyGoal" TEXT,
    "successLooksLike" TEXT,
    "completionFeeling" TEXT,
    "motivationIcon" TEXT,
    "description" TEXT,

    CONSTRAINT "athlete_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."athlete_health_records" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'garmin',
    "healthType" TEXT NOT NULL,
    "sourceSummaryId" TEXT,
    "calendarDate" TIMESTAMP(3),
    "summaryData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."athlete_race_results" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "signupId" TEXT,
    "goalId" TEXT,
    "officialFinishTime" TEXT,
    "chipTime" TEXT,
    "gunTime" TEXT,
    "actualDistanceMeters" DOUBLE PRECISION,
    "actualAvgPaceSecPerMile" INTEGER,
    "overallPlace" INTEGER,
    "ageGroupPlace" INTEGER,
    "divisionPlace" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "garminActivityId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishTimeSeconds" INTEGER,
    "goalTimeSeconds" INTEGER,
    "goalTimeDeltaSeconds" INTEGER,
    "goalAchieved" BOOLEAN NOT NULL DEFAULT false,
    "prAchieved" BOOLEAN NOT NULL DEFAULT false,
    "previousPrSeconds" INTEGER,
    "raceDate" TIMESTAMP(3),
    "distanceLabel" TEXT,
    "reflection" TEXT,
    "howFeltRating" INTEGER,
    "racePhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "athlete_race_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."athlete_race_signups" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "selfDeclaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalId" TEXT,
    "notifyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_race_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bike_workout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "ftpWattsSnapshot" INTEGER,
    "estimatedDurationSeconds" INTEGER,
    "garminWorkoutId" INTEGER,
    "garminScheduleId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "matchedActivityId" TEXT,
    "actualDurationSeconds" INTEGER,
    "actualDistanceMeters" DOUBLE PRECISION,
    "actualAvgPowerWatts" INTEGER,
    "actualAverageHeartRate" INTEGER,
    "actualMaxHeartRate" INTEGER,
    "actualElevationGain" DOUBLE PRECISION,
    "actualCalories" INTEGER,
    "powerDeltaWatts" INTEGER,

    CONSTRAINT "bike_workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bike_workout_step" (
    "id" TEXT NOT NULL,
    "bikeWorkoutId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "repeatCount" INTEGER,
    "durationType" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "powerWattsLow" INTEGER,
    "powerWattsHigh" INTEGER,
    "heartRateLow" INTEGER,
    "heartRateHigh" INTEGER,
    "cadenceLow" INTEGER,
    "cadenceHigh" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bike_workout_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."brands" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandType" "public"."BrandType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "websiteUrl" TEXT,
    "instagramHandle" TEXT,
    "logoUrl" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."city_run_activity_links" (
    "id" TEXT NOT NULL,
    "cityRunId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "activityId" TEXT,
    "linkedManually" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "city_run_activity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."city_run_checkins" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runPhotoUrl" TEXT,
    "runShouts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_run_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."city_run_messages" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_run_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."city_run_rsvps" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "rsvpStatus" "public"."RSVPStatus" NOT NULL DEFAULT 'GOING',
    "participationStatus" "public"."ParticipationStatus",
    "verifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "garminActivityId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rsvpPhotoUrls" JSONB,
    "occurrenceDate" TIMESTAMP(3),

    CONSTRAINT "run_crew_run_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."city_runs" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "meetUpPoint" TEXT NOT NULL,
    "meetUpPlaceId" TEXT,
    "meetUpLat" DOUBLE PRECISION,
    "meetUpLng" DOUBLE PRECISION,
    "totalMiles" DOUBLE PRECISION,
    "pace" TEXT,
    "stravaMapUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startTimeHour" INTEGER,
    "startTimeMinute" INTEGER,
    "startTimePeriod" TEXT,
    "athleteGeneratedId" TEXT,
    "staffGeneratedId" TEXT,
    "gofastCity" TEXT NOT NULL,
    "dayOfWeek" TEXT,
    "endPoint" TEXT,
    "meetUpStreetAddress" TEXT,
    "meetUpCity" TEXT,
    "meetUpState" TEXT,
    "meetUpZip" TEXT,
    "endStreetAddress" TEXT,
    "endCity" TEXT,
    "endState" TEXT,
    "runClubId" TEXT,
    "slug" TEXT,
    "routePhotos" JSONB,
    "mapImageUrl" TEXT,
    "workflowStatus" "public"."RunWorkflowStatus" NOT NULL DEFAULT 'DEVELOP',
    "staffNotes" TEXT,
    "postRunActivity" TEXT,
    "routeNeighborhood" TEXT,
    "runType" TEXT,
    "workoutDescription" TEXT,
    "stravaEventUrl" TEXT,
    "stravaText" TEXT,
    "webUrl" TEXT,
    "webText" TEXT,
    "igPostText" TEXT,
    "igPostGraphic" TEXT,
    "runSeriesId" TEXT,
    "locationId" TEXT,
    "routeId" TEXT,
    "workoutId" TEXT,
    "raceRegistryId" TEXT,
    "shakeoutDedupeKey" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "cityRunType" "public"."CityRunType" NOT NULL DEFAULT 'OTHER',
    "directionsText" TEXT,

    CONSTRAINT "run_crew_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coach" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firebase_uid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "coaching_philosophy" TEXT,
    "years_coaching" INTEGER,
    "bio" TEXT,
    "city" TEXT,
    "instagram" TEXT,
    "phone_number" TEXT,
    "photo_url" TEXT,
    "state" TEXT,

    CONSTRAINT "coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coach_event_volunteer_jobs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "needed_count" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_event_volunteer_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coach_event_volunteer_signups" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "parent_name" TEXT NOT NULL,
    "parent_email" TEXT NOT NULL,
    "parent_phone" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_event_volunteer_signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coach_events" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "season_club_id" TEXT,
    "team_id" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "event_date" TIMESTAMP(3),
    "start_time_label" TEXT,
    "location_label" TEXT,
    "strava_url" TEXT,
    "map_image_url" TEXT,
    "route_description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coaches" (
    "id" TEXT NOT NULL,
    "firebaseId" TEXT NOT NULL,
    "email" TEXT,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "photoURL" TEXT,
    "bio" TEXT,
    "specialty" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."easy_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "easy_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."easy_config_position" (
    "id" TEXT NOT NULL,
    "easyConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "easy_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."go_fast_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "go_fast_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gofast_container_memberships" (
    "id" TEXT NOT NULL,
    "containerAthleteId" TEXT NOT NULL,
    "memberAthleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gofast_container_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gofast_container_messages" (
    "id" TEXT NOT NULL,
    "containerAthleteId" TEXT NOT NULL,
    "authorAthleteId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gofast_container_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."intervals_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervals_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."intervals_config_position" (
    "id" TEXT NOT NULL,
    "intervalsConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intervals_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."join_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "join_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."levelup_url_roles" (
    "id" TEXT NOT NULL,
    "hostname_pattern" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelup_url_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."levelup_workout_segments" (
    "id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "duration_type" TEXT NOT NULL,
    "duration_value" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levelup_workout_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."levelup_workouts" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "workout_type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "team_id" TEXT,
    "run_program_session_id" TEXT,
    "season_club_id" TEXT,

    CONSTRAINT "levelup_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."long_run_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "long_run_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."long_run_config_position" (
    "id" TEXT NOT NULL,
    "longRunConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "long_run_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."navigation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "route_to" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pace_adjustment_log" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "planId" TEXT,
    "weekNumber" INTEGER,
    "previousPaceSecPerMile" INTEGER,
    "newPaceSecPerMile" INTEGER,
    "adjustmentSecPerMile" INTEGER,
    "qualityWorkoutsCount" INTEGER NOT NULL DEFAULT 0,
    "qualityAvgDeltaSecPerMile" INTEGER,
    "longRunCompleted" BOOLEAN NOT NULL DEFAULT false,
    "longRunCompletionRatio" DOUBLE PRECISION,
    "weeklyMileageCompletionPct" DOUBLE PRECISION,
    "summaryMessage" TEXT,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workoutId" TEXT,
    "notificationType" TEXT DEFAULT 'PACE_UPDATE',

    CONSTRAINT "pace_adjustment_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."player_assessments" (
    "id" TEXT NOT NULL,
    "young_athlete_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "notes" TEXT,
    "scores" JSONB,
    "assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "team_id" TEXT,
    "season_club_id" TEXT,

    CONSTRAINT "player_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."practice_block_activities" (
    "id" TEXT NOT NULL,
    "practice_block_id" TEXT NOT NULL,
    "sport_activity_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "custom_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_block_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."practice_blocks" (
    "id" TEXT NOT NULL,
    "practice_id" TEXT NOT NULL,
    "block_type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "duration_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."practices" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sport" TEXT,
    "practice_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_companies" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "location" TEXT,
    "how_long_in_business" TEXT,
    "values" TEXT,
    "why_the_best" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_owner_coach_links" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_owner_coach_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."program_owners" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "photo_url" TEXT,
    "experience" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_announcements" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "authorId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "staffGeneratedId" TEXT,

    CONSTRAINT "race_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_events" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "additionalDetails" TEXT,
    "cost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_memberships" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" "public"."RaceMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_messages" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_registry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'USA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "charityName" TEXT,
    "charityUrl" TEXT,
    "courseMapUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "officialWebsiteUrl" TEXT,
    "raceDate" TIMESTAMP(3) NOT NULL,
    "registrationCloseDate" TIMESTAMP(3),
    "registrationFee" DOUBLE PRECISION,
    "registrationOpenDate" TIMESTAMP(3),
    "registrationUrl" TEXT,
    "resultsUrl" TEXT,
    "slug" TEXT,
    "startTime" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "companyRaceId" TEXT,
    "logoUrl" TEXT,
    "distanceLabel" TEXT,
    "packetPickupLocation" TEXT,
    "packetPickupDate" TIMESTAMP(3),
    "packetPickupTime" TEXT,
    "packetPickupDescription" TEXT,
    "spectatorInfo" TEXT,
    "logisticsInfo" TEXT,
    "gearDropInstructions" TEXT,
    "distanceMeters" INTEGER,
    "summaryPhrase" TEXT,
    "courseSlug" TEXT,
    "registrationOpenNow" BOOLEAN NOT NULL DEFAULT false,
    "companyRegistrationId" TEXT,
    "parentRaceId" TEXT,
    "registrationSoldOut" BOOLEAN NOT NULL DEFAULT false,
    "transferDeadline" TIMESTAMP(3),

    CONSTRAINT "race_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."race_registry_course_segments" (
    "id" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "companySegmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mileMarker" TEXT,
    "description" TEXT,
    "runTip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "race_registry_course_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."routes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stravaUrl" TEXT,
    "distanceMiles" DOUBLE PRECISION,
    "stravaMapUrl" TEXT,
    "mapImageUrl" TEXT,
    "routePhotos" JSONB,
    "routeNeighborhood" TEXT,
    "runType" TEXT,
    "gofastCity" TEXT,
    "createdByAthleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_club_announcements" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'members',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_club_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'going',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_club_events" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'social',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_club_memberships" (
    "id" TEXT NOT NULL,
    "runClubId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_club_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_clubs" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "city" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "id" TEXT NOT NULL,
    "description" TEXT,
    "websiteUrl" TEXT,
    "instagramUrl" TEXT,
    "stravaUrl" TEXT,
    "runUrl" TEXT,
    "allRunsDescription" TEXT,
    "state" TEXT,
    "neighborhood" TEXT,
    "gofastCity" TEXT,
    "isMultiSite" BOOLEAN NOT NULL DEFAULT false,
    "brandId" TEXT,

    CONSTRAINT "run_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_crew_announcements" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(6),

    CONSTRAINT "run_crew_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_crew_event_rsvps" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_crew_event_rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_crew_events" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "additionalDetails" TEXT,
    "cost" INTEGER,
    "venue" TEXT NOT NULL,

    CONSTRAINT "run_crew_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_crew_memberships" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "public"."RunCrewRole" NOT NULL DEFAULT 'member',

    CONSTRAINT "run_crew_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_crew_messages" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_crew_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_crew_specific_races" (
    "id" TEXT NOT NULL,
    "runCrewId" TEXT NOT NULL,
    "raceRegistryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "run_crew_specific_races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_crews" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "logo" TEXT,
    "icon" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "messageTopics" JSONB,
    "city" TEXT,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "primaryMeetUpPoint" TEXT,
    "primaryMeetUpAddress" TEXT,
    "primaryMeetUpPlaceId" TEXT,
    "primaryMeetUpLat" DOUBLE PRECISION,
    "primaryMeetUpLng" DOUBLE PRECISION,
    "gender" "public"."Gender",
    "state" "public"."State",
    "typicalRunMiles" DOUBLE PRECISION,
    "longRunMilesMin" DOUBLE PRECISION,
    "longRunMilesMax" DOUBLE PRECISION,
    "timePreference" "public"."TimePreference"[] DEFAULT ARRAY[]::"public"."TimePreference"[],
    "purpose" "public"."Purpose"[] DEFAULT ARRAY[]::"public"."Purpose"[],
    "trainingForRace" TEXT,
    "trainingForDistance" "public"."TrainingForDistance"[] DEFAULT ARRAY[]::"public"."TrainingForDistance"[],
    "easyMilesPace" INTEGER,
    "crushingItPace" INTEGER,
    "handle" TEXT NOT NULL,

    CONSTRAINT "run_crews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_journal_entries" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_locations" (
    "id" TEXT NOT NULL,
    "gofastCity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "runType" TEXT,
    "shape" "public"."RouteShape",
    "terrain" "public"."RouteTerrain",
    "surface" "public"."RouteSurface",
    "traffic" "public"."RouteTraffic",
    "lighting" "public"."RouteLighting",
    "shade" "public"."RouteShade",
    "vibes" "public"."RouteVibe"[] DEFAULT ARRAY[]::"public"."RouteVibe"[],
    "loopMiles" DOUBLE PRECISION,
    "notes" TEXT,
    "stravaUrl" TEXT,
    "meetUpPoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_parents" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "firebase_uid" TEXT,
    "phone_number" TEXT,

    CONSTRAINT "run_parents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_program_memberships" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT,
    "run_parent_id" TEXT,
    "young_athlete_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "season_club_id" TEXT NOT NULL,

    CONSTRAINT "run_program_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_program_satellites" (
    "id" TEXT NOT NULL,
    "run_program_id" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_coach_id" TEXT,

    CONSTRAINT "run_program_satellites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_program_sessions" (
    "id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "week_focus" TEXT,
    "goal" TEXT,
    "session_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "season_club_id" TEXT NOT NULL,

    CONSTRAINT "run_program_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_programs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "about" TEXT,
    "mission" TEXT,
    "program" TEXT,
    "what_you_ll_get" TEXT[],
    "run_schedule" TEXT,
    "logo_url" TEXT,
    "city" TEXT,
    "state" TEXT,
    "neighborhood" TEXT,
    "website_url" TEXT,
    "instagram_handle" TEXT,
    "run_program_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "price_cents" INTEGER,
    "price_display" TEXT,
    "created_by_coach_id" TEXT,
    "hero_image_url" TEXT,
    "owner_id" TEXT,
    "company_id" TEXT,

    CONSTRAINT "run_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."run_series" (
    "id" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "runClubId" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "gofastCity" TEXT,
    "meetUpPoint" TEXT,
    "meetUpStreetAddress" TEXT,
    "meetUpCity" TEXT,
    "meetUpState" TEXT,
    "meetUpPlaceId" TEXT,
    "meetUpLat" DOUBLE PRECISION,
    "meetUpLng" DOUBLE PRECISION,
    "startTimeHour" INTEGER,
    "startTimeMinute" INTEGER,
    "startTimePeriod" TEXT,
    "slug" TEXT,
    "workflowStatus" "public"."RunWorkflowStatus" NOT NULL DEFAULT 'DEVELOP',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "seriesRunRawText" TEXT,
    "endPoint" TEXT,
    "endStreetAddress" TEXT,
    "endCity" TEXT,
    "endState" TEXT,
    "runType" TEXT,
    "totalMiles" DOUBLE PRECISION,
    "routeNeighborhood" TEXT,
    "workoutDescription" TEXT,
    "postRunActivity" TEXT,

    CONSTRAINT "city_run_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."scheduled_runs" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "workoutId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTimeLabel" TEXT,
    "title" TEXT NOT NULL,
    "estimatedDistanceMi" DOUBLE PRECISION,
    "isTrack" BOOLEAN NOT NULL DEFAULT false,
    "stravaRouteUrl" TEXT,
    "meetupLocation" TEXT,
    "routeDescription" TEXT,
    "shareSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."season_clubs" (
    "id" TEXT NOT NULL,
    "run_program_satellite_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "join_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sport_activities" (
    "id" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "what_is_it" TEXT,
    "what_want_players_to_do" TEXT,
    "player_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activity_type" TEXT NOT NULL,
    "focus_area" TEXT,
    "player_format" TEXT,

    CONSTRAINT "sport_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."swim_workout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "poolLengthMeters" INTEGER,
    "cssSecPer100m" INTEGER,
    "garminWorkoutId" INTEGER,
    "garminScheduleId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swim_workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."swim_workout_step" (
    "id" TEXT NOT NULL,
    "swimWorkoutId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "intensity" TEXT NOT NULL,
    "repeatCount" INTEGER,
    "durationType" TEXT NOT NULL,
    "durationMeters" INTEGER,
    "durationSeconds" INTEGER,
    "paceSecPer100mLow" INTEGER,
    "paceSecPer100mHigh" INTEGER,
    "strokeType" TEXT,
    "equipment" TEXT,
    "heartRateLow" INTEGER,
    "heartRateHigh" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swim_workout_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_memberships" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "coach_id" TEXT,
    "run_parent_id" TEXT,
    "young_athlete_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_seasons" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "join_code" TEXT,
    "coach_id" TEXT NOT NULL,
    "sport" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "icon" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tempo_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tempo_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tempo_config_position" (
    "id" TEXT NOT NULL,
    "tempoConfigId" TEXT NOT NULL,
    "cyclePosition" INTEGER NOT NULL,
    "distributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "catalogueWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tempo_config_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_cohort_announcements" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "staffGeneratedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "training_cohort_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_cohort_memberships" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainingPlanId" TEXT,
    "role" "public"."TrainingCohortRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_cohort_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_cohort_messages" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_cohort_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_cohorts" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "companyRaceId" TEXT,
    "presetId" TEXT NOT NULL,
    "cohortName" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "joinCode" TEXT NOT NULL,
    "defaultPlanStartDate" TIMESTAMP(3),
    "status" "public"."TrainingCohortStatus" NOT NULL DEFAULT 'DRAFT',
    "companyStaffId" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_plan_preset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "longRunConfigId" TEXT,
    "intervalsConfigId" TEXT,
    "tempoConfigId" TEXT,
    "publicDescription" TEXT,
    "targetDistanceLabel" TEXT,
    "cycleLen" INTEGER NOT NULL DEFAULT 4,
    "minWeeklyMiles" INTEGER NOT NULL DEFAULT 40,
    "maxWeeklyMiles" INTEGER,
    "baseMiles" DOUBLE PRECISION NOT NULL,
    "peakMiles" DOUBLE PRECISION NOT NULL,
    "taperMiles" DOUBLE PRECISION NOT NULL,
    "tempoIdealDow" INTEGER NOT NULL DEFAULT 2,
    "intervalIdealDow" INTEGER NOT NULL DEFAULT 4,
    "longRunDefaultDow" INTEGER NOT NULL DEFAULT 6,
    "easyRunConfig" JSONB,
    "easyConfigId" TEXT,

    CONSTRAINT "training_plan_preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_plans" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "raceId" TEXT,
    "name" TEXT NOT NULL,
    "currentWeeklyMileage" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "totalWeeks" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "athleteGoalId" TEXT,
    "phases" JSONB,
    "planSchedule" JSONB,
    "preferredDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lifecycleStatus" "public"."TrainingPlanLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "currentFiveKPace" TEXT,
    "weeklyMileageTarget" INTEGER,
    "preferredLongRunDow" INTEGER,
    "presetId" TEXT,
    "coachReviewStatus" "public"."CoachReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "preferredQualityDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "goalRaceTime" TEXT,
    "goalRacePace" TEXT,
    "peakWeekNumber" INTEGER,
    "taperStartWeekNumber" INTEGER,
    "calculatedLongRunMax" DOUBLE PRECISION,
    "preferredTempoDow" INTEGER,
    "preferredIntervalDow" INTEGER,
    "cyclePoolData" JSONB,
    "easyRunConfig" JSONB,
    "cohortId" TEXT,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."training_preferences" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "preferredDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "weeklyMileageTarget" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tri_workout" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tri_workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tri_workout_leg" (
    "id" TEXT NOT NULL,
    "triWorkoutId" TEXT NOT NULL,
    "legOrder" INTEGER NOT NULL,
    "sport" "public"."TriSport" NOT NULL,
    "title" TEXT,
    "bikeWorkoutId" TEXT,
    "swimWorkoutId" TEXT,
    "runWorkoutId" TEXT,

    CONSTRAINT "tri_workout_leg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workout_catalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workoutType" "public"."WorkoutType" NOT NULL,
    "workBaseReps" INTEGER,
    "workBaseRepMeters" INTEGER,
    "recoveryDistanceMeters" INTEGER,
    "warmupMiles" DOUBLE PRECISION,
    "cooldownMiles" DOUBLE PRECISION,
    "workBasePaceOffsetSecPerMile" INTEGER,
    "recoveryPaceOffsetSecPerMile" INTEGER,
    "workPaceOffsetSecPerMile" INTEGER,
    "intendedHeartRateZone" TEXT,
    "intendedHRBpmLow" INTEGER,
    "intendedHRBpmHigh" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paceAnchor" TEXT NOT NULL DEFAULT 'currentBuildup',
    "mpFraction" DOUBLE PRECISION,
    "mpBlockPosition" TEXT,
    "mpBlockProgression" TEXT NOT NULL DEFAULT 'flat',
    "description" TEXT,
    "warmupPaceOffsetSecPerMile" INTEGER,
    "cooldownPaceOffsetSecPerMile" INTEGER,
    "workBaseMiles" DOUBLE PRECISION,
    "mpTotalMiles" DOUBLE PRECISION,
    "mpPaceOffsetSecPerMile" INTEGER,
    "slug" TEXT,
    "runSubType" TEXT,
    "segmentPaceDist" JSONB,
    "warmupFraction" DOUBLE PRECISION,
    "workFraction" DOUBLE PRECISION,
    "cooldownFraction" DOUBLE PRECISION,
    "recoveryDurationSeconds" INTEGER,
    "trainingIntent" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "workout_catalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workout_segment_laps" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "lapIndex" INTEGER NOT NULL,
    "startTimeInSeconds" INTEGER NOT NULL,
    "endTimeInSeconds" INTEGER NOT NULL,
    "avgPaceSecPerMile" INTEGER,
    "avgHeartRate" INTEGER,
    "distanceMiles" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "workout_segment_laps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workout_segments" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationType" TEXT NOT NULL,
    "durationValue" DOUBLE PRECISION NOT NULL,
    "targets" JSONB,
    "repeatCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "actualPaceSecPerMile" INTEGER,
    "actualDistanceMiles" DOUBLE PRECISION,
    "actualDurationSeconds" INTEGER,
    "paceTargetEncodingVersion" INTEGER NOT NULL DEFAULT 2,
    "recoveryDurationType" TEXT,
    "recoveryDurationValue" DOUBLE PRECISION,

    CONSTRAINT "workout_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workouts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "workoutType" "public"."WorkoutType" NOT NULL,
    "description" TEXT,
    "workoutFormat" "public"."WorkoutFormat",
    "totalMiles" DOUBLE PRECISION,
    "warmUpMiles" DOUBLE PRECISION,
    "mainSetMiles" DOUBLE PRECISION,
    "coolDownMiles" DOUBLE PRECISION,
    "effortType" "public"."EffortType",
    "effortModifier" DOUBLE PRECISION,
    "athleteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planId" TEXT,
    "date" TIMESTAMP(3),
    "estimatedDistanceInMeters" DOUBLE PRECISION,
    "matchedActivityId" TEXT,
    "actualDistanceMeters" DOUBLE PRECISION,
    "actualAvgPaceSecPerMile" INTEGER,
    "actualAverageHeartRate" INTEGER,
    "actualDurationSeconds" INTEGER,
    "garminWorkoutId" INTEGER,
    "actualMaxHeartRate" INTEGER,
    "actualElevationGain" DOUBLE PRECISION,
    "actualCalories" INTEGER,
    "actualSteps" INTEGER,
    "paceDeltaSecPerMile" INTEGER,
    "targetPaceSecPerMile" INTEGER,
    "evaluationEligibleFlag" BOOLEAN NOT NULL DEFAULT false,
    "catalogueWorkoutId" TEXT,
    "nOffset" INTEGER,
    "weekNumber" INTEGER,
    "dayAssigned" TEXT,
    "planCycleIndex" INTEGER,
    "slug" TEXT,
    "garminScheduleId" INTEGER,
    "creditedFiveKPaceSecPerMile" INTEGER,
    "hrDeltaBpm" INTEGER,
    "targetPaceSecPerMileHigh" INTEGER,
    "segmentSnapshotJson" JSONB,
    "completedActivitySummaryJson" JSONB,
    "completedActivityDetailJson" JSONB,
    "analysisJson" JSONB,
    "creditedThresholdPaceSecPerMile" INTEGER,
    "creditedAerobicCeilingBpm" INTEGER,
    "prescriptionNarrative" TEXT,
    "runContextTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "runContextNote" TEXT,
    "runContextUpdatedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "skipReason" TEXT,
    "segmentExecutionStatus" TEXT,
    "segmentExecutionLapCount" INTEGER,
    "segmentExecutionSegmentCount" INTEGER,
    "runClubId" TEXT,
    "createdByStaffId" TEXT,
    "scope" "public"."WorkoutScope" NOT NULL DEFAULT 'ATHLETE',

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."young_athletes" (
    "id" TEXT NOT NULL,
    "run_parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "secondary_run_parent_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,

    CONSTRAINT "young_athletes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_firebaseId_key" ON "public"."Athlete"("firebaseId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_garmin_user_id_key" ON "public"."Athlete"("garmin_user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_gofastHandle_key" ON "public"."Athlete"("gofastHandle" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Athlete_strava_id_key" ON "public"."Athlete"("strava_id" ASC);

-- CreateIndex
CREATE INDEX "ambassador_credits_athleteId_idx" ON "public"."ambassador_credits"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ambassador_credits_cityRunRsvpId_key" ON "public"."ambassador_credits"("cityRunRsvpId" ASC);

-- CreateIndex
CREATE INDEX "ambassador_credits_createdAt_idx" ON "public"."ambassador_credits"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "ambassador_payouts_athleteId_idx" ON "public"."ambassador_payouts"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "ambassador_payouts_processedAt_idx" ON "public"."ambassador_payouts"("processedAt" ASC);

-- CreateIndex
CREATE INDEX "appnotification_deliveries_athleteId_readAt_idx" ON "public"."appnotification_deliveries"("athleteId" ASC, "readAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "appnotification_deliveries_dedupeKey_key" ON "public"."appnotification_deliveries"("dedupeKey" ASC);

-- CreateIndex
CREATE INDEX "appnotification_deliveries_templateKey_objectType_objectId_idx" ON "public"."appnotification_deliveries"("templateKey" ASC, "objectType" ASC, "objectId" ASC);

-- CreateIndex
CREATE INDEX "athlete_activities_athleteId_ingestionStatus_idx" ON "public"."athlete_activities"("athleteId" ASC, "ingestionStatus" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_activities_sourceActivityId_key" ON "public"."athlete_activities"("sourceActivityId" ASC);

-- CreateIndex
CREATE INDEX "athlete_appnotification_devices_athleteId_idx" ON "public"."athlete_appnotification_devices"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_appnotification_devices_expoPushToken_key" ON "public"."athlete_appnotification_devices"("expoPushToken" ASC);

-- CreateIndex
CREATE INDEX "athlete_goals_athleteId_idx" ON "public"."athlete_goals"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "athlete_goals_athleteId_status_idx" ON "public"."athlete_goals"("athleteId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "athlete_goals_raceRegistryId_idx" ON "public"."athlete_goals"("raceRegistryId" ASC);

-- CreateIndex
CREATE INDEX "athlete_health_records_athleteId_healthType_calendarDate_idx" ON "public"."athlete_health_records"("athleteId" ASC, "healthType" ASC, "calendarDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_health_records_source_healthType_sourceSummaryId_key" ON "public"."athlete_health_records"("source" ASC, "healthType" ASC, "sourceSummaryId" ASC);

-- CreateIndex
CREATE INDEX "athlete_race_results_athleteId_idx" ON "public"."athlete_race_results"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_results_athleteId_raceRegistryId_key" ON "public"."athlete_race_results"("athleteId" ASC, "raceRegistryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_results_garminActivityId_key" ON "public"."athlete_race_results"("garminActivityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_results_goalId_key" ON "public"."athlete_race_results"("goalId" ASC);

-- CreateIndex
CREATE INDEX "athlete_race_results_raceRegistryId_idx" ON "public"."athlete_race_results"("raceRegistryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_results_signupId_key" ON "public"."athlete_race_results"("signupId" ASC);

-- CreateIndex
CREATE INDEX "athlete_race_signups_athleteId_idx" ON "public"."athlete_race_signups"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_race_signups_athleteId_raceRegistryId_key" ON "public"."athlete_race_signups"("athleteId" ASC, "raceRegistryId" ASC);

-- CreateIndex
CREATE INDEX "athlete_race_signups_raceRegistryId_idx" ON "public"."athlete_race_signups"("raceRegistryId" ASC);

-- CreateIndex
CREATE INDEX "bike_workout_athleteId_date_idx" ON "public"."bike_workout"("athleteId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "bike_workout_athleteId_idx" ON "public"."bike_workout"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "bike_workout_matchedActivityId_key" ON "public"."bike_workout"("matchedActivityId" ASC);

-- CreateIndex
CREATE INDEX "bike_workout_step_bikeWorkoutId_idx" ON "public"."bike_workout_step"("bikeWorkoutId" ASC);

-- CreateIndex
CREATE INDEX "bike_workout_step_bikeWorkoutId_stepOrder_idx" ON "public"."bike_workout_step"("bikeWorkoutId" ASC, "stepOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "public"."brands"("slug" ASC);

-- CreateIndex
CREATE INDEX "cities_name_idx" ON "public"."cities"("name" ASC);

-- CreateIndex
CREATE INDEX "cities_slug_idx" ON "public"."cities"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "public"."cities"("slug" ASC);

-- CreateIndex
CREATE INDEX "city_run_activity_links_activityId_idx" ON "public"."city_run_activity_links"("activityId" ASC);

-- CreateIndex
CREATE INDEX "city_run_activity_links_athleteId_idx" ON "public"."city_run_activity_links"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "city_run_activity_links_cityRunId_athleteId_key" ON "public"."city_run_activity_links"("cityRunId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "city_run_checkins_athleteId_idx" ON "public"."city_run_checkins"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "city_run_checkins_runId_athleteId_key" ON "public"."city_run_checkins"("runId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "city_run_checkins_runId_idx" ON "public"."city_run_checkins"("runId" ASC);

-- CreateIndex
CREATE INDEX "city_run_messages_athleteId_idx" ON "public"."city_run_messages"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "city_run_messages_runId_idx" ON "public"."city_run_messages"("runId" ASC);

-- CreateIndex
CREATE INDEX "city_run_messages_topic_idx" ON "public"."city_run_messages"("topic" ASC);

-- CreateIndex
CREATE INDEX "city_run_rsvps_occurrenceDate_idx" ON "public"."city_run_rsvps"("occurrenceDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_crew_run_rsvps_runId_athleteId_key" ON "public"."city_run_rsvps"("runId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "city_runs_cityRunType_idx" ON "public"."city_runs"("cityRunType" ASC);

-- CreateIndex
CREATE INDEX "city_runs_locationId_idx" ON "public"."city_runs"("locationId" ASC);

-- CreateIndex
CREATE INDEX "city_runs_raceRegistryId_idx" ON "public"."city_runs"("raceRegistryId" ASC);

-- CreateIndex
CREATE INDEX "city_runs_routeId_idx" ON "public"."city_runs"("routeId" ASC);

-- CreateIndex
CREATE INDEX "city_runs_runSeriesId_idx" ON "public"."city_runs"("runSeriesId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "city_runs_shakeoutDedupeKey_key" ON "public"."city_runs"("shakeoutDedupeKey" ASC);

-- CreateIndex
CREATE INDEX "city_runs_slug_idx" ON "public"."city_runs"("slug" ASC);

-- CreateIndex
CREATE INDEX "city_runs_workflowStatus_idx" ON "public"."city_runs"("workflowStatus" ASC);

-- CreateIndex
CREATE INDEX "city_runs_workoutId_idx" ON "public"."city_runs"("workoutId" ASC);

-- CreateIndex
CREATE INDEX "run_crew_runs_athleteGeneratedId_idx" ON "public"."city_runs"("athleteGeneratedId" ASC);

-- CreateIndex
CREATE INDEX "run_crew_runs_citySlug_idx" ON "public"."city_runs"("gofastCity" ASC);

-- CreateIndex
CREATE INDEX "run_crew_runs_date_idx" ON "public"."city_runs"("date" ASC);

-- CreateIndex
CREATE INDEX "run_crew_runs_dayOfWeek_idx" ON "public"."city_runs"("dayOfWeek" ASC);

-- CreateIndex
CREATE INDEX "run_crew_runs_runClubId_idx" ON "public"."city_runs"("runClubId" ASC);

-- CreateIndex
CREATE INDEX "run_crew_runs_runCrewId_idx" ON "public"."city_runs"("runCrewId" ASC);

-- CreateIndex
CREATE INDEX "run_crew_runs_staffGeneratedId_idx" ON "public"."city_runs"("staffGeneratedId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coach_email_key" ON "public"."coach"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coach_firebase_uid_key" ON "public"."coach"("firebase_uid" ASC);

-- CreateIndex
CREATE INDEX "coach_event_volunteer_jobs_event_id_idx" ON "public"."coach_event_volunteer_jobs"("event_id" ASC);

-- CreateIndex
CREATE INDEX "coach_event_volunteer_signups_event_id_idx" ON "public"."coach_event_volunteer_signups"("event_id" ASC);

-- CreateIndex
CREATE INDEX "coach_event_volunteer_signups_job_id_idx" ON "public"."coach_event_volunteer_signups"("job_id" ASC);

-- CreateIndex
CREATE INDEX "coach_event_volunteer_signups_parent_email_idx" ON "public"."coach_event_volunteer_signups"("parent_email" ASC);

-- CreateIndex
CREATE INDEX "coach_events_coach_id_idx" ON "public"."coach_events"("coach_id" ASC);

-- CreateIndex
CREATE INDEX "coach_events_event_date_idx" ON "public"."coach_events"("event_date" ASC);

-- CreateIndex
CREATE INDEX "coach_events_season_club_id_idx" ON "public"."coach_events"("season_club_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coach_events_slug_key" ON "public"."coach_events"("slug" ASC);

-- CreateIndex
CREATE INDEX "coach_events_status_idx" ON "public"."coach_events"("status" ASC);

-- CreateIndex
CREATE INDEX "coach_events_team_id_idx" ON "public"."coach_events"("team_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coaches_firebaseId_key" ON "public"."coaches"("firebaseId" ASC);

-- CreateIndex
CREATE INDEX "easy_config_name_idx" ON "public"."easy_config"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "easy_config_position_easyConfigId_cyclePosition_key" ON "public"."easy_config_position"("easyConfigId" ASC, "cyclePosition" ASC);

-- CreateIndex
CREATE INDEX "easy_config_position_easyConfigId_idx" ON "public"."easy_config_position"("easyConfigId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "go_fast_companies_slug_key" ON "public"."go_fast_companies"("slug" ASC);

-- CreateIndex
CREATE INDEX "gofast_container_memberships_containerAthleteId_idx" ON "public"."gofast_container_memberships"("containerAthleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "gofast_container_memberships_containerAthleteId_memberAthleteId" ON "public"."gofast_container_memberships"("containerAthleteId" ASC, "memberAthleteId" ASC);

-- CreateIndex
CREATE INDEX "gofast_container_messages_containerAthleteId_createdAt_idx" ON "public"."gofast_container_messages"("containerAthleteId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "intervals_config_name_idx" ON "public"."intervals_config"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "intervals_config_position_intervalsConfigId_cyclePosition_key" ON "public"."intervals_config_position"("intervalsConfigId" ASC, "cyclePosition" ASC);

-- CreateIndex
CREATE INDEX "intervals_config_position_intervalsConfigId_idx" ON "public"."intervals_config_position"("intervalsConfigId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "join_codes_code_key" ON "public"."join_codes"("code" ASC);

-- CreateIndex
CREATE INDEX "levelup_url_roles_hostname_pattern_idx" ON "public"."levelup_url_roles"("hostname_pattern" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "levelup_url_roles_hostname_pattern_key" ON "public"."levelup_url_roles"("hostname_pattern" ASC);

-- CreateIndex
CREATE INDEX "levelup_url_roles_role_idx" ON "public"."levelup_url_roles"("role" ASC);

-- CreateIndex
CREATE INDEX "levelup_workout_segments_workout_id_idx" ON "public"."levelup_workout_segments"("workout_id" ASC);

-- CreateIndex
CREATE INDEX "levelup_workouts_coach_id_idx" ON "public"."levelup_workouts"("coach_id" ASC);

-- CreateIndex
CREATE INDEX "levelup_workouts_run_program_session_id_idx" ON "public"."levelup_workouts"("run_program_session_id" ASC);

-- CreateIndex
CREATE INDEX "levelup_workouts_season_club_id_idx" ON "public"."levelup_workouts"("season_club_id" ASC);

-- CreateIndex
CREATE INDEX "levelup_workouts_team_id_idx" ON "public"."levelup_workouts"("team_id" ASC);

-- CreateIndex
CREATE INDEX "long_run_config_name_idx" ON "public"."long_run_config"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "long_run_config_position_longRunConfigId_cyclePosition_key" ON "public"."long_run_config_position"("longRunConfigId" ASC, "cyclePosition" ASC);

-- CreateIndex
CREATE INDEX "long_run_config_position_longRunConfigId_idx" ON "public"."long_run_config_position"("longRunConfigId" ASC);

-- CreateIndex
CREATE INDEX "navigation_url_idx" ON "public"."navigation"("url" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "navigation_url_key" ON "public"."navigation"("url" ASC);

-- CreateIndex
CREATE INDEX "pace_adjustment_log_athleteId_seenAt_idx" ON "public"."pace_adjustment_log"("athleteId" ASC, "seenAt" ASC);

-- CreateIndex
CREATE INDEX "pace_adjustment_log_planId_weekNumber_idx" ON "public"."pace_adjustment_log"("planId" ASC, "weekNumber" ASC);

-- CreateIndex
CREATE INDEX "player_assessments_coach_id_idx" ON "public"."player_assessments"("coach_id" ASC);

-- CreateIndex
CREATE INDEX "player_assessments_season_club_id_idx" ON "public"."player_assessments"("season_club_id" ASC);

-- CreateIndex
CREATE INDEX "player_assessments_team_id_idx" ON "public"."player_assessments"("team_id" ASC);

-- CreateIndex
CREATE INDEX "player_assessments_young_athlete_id_idx" ON "public"."player_assessments"("young_athlete_id" ASC);

-- CreateIndex
CREATE INDEX "practice_block_activities_practice_block_id_idx" ON "public"."practice_block_activities"("practice_block_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "practice_block_activities_practice_block_id_sport_activity__key" ON "public"."practice_block_activities"("practice_block_id" ASC, "sport_activity_id" ASC, "order" ASC);

-- CreateIndex
CREATE INDEX "practice_block_activities_sport_activity_id_idx" ON "public"."practice_block_activities"("sport_activity_id" ASC);

-- CreateIndex
CREATE INDEX "practice_blocks_block_type_idx" ON "public"."practice_blocks"("block_type" ASC);

-- CreateIndex
CREATE INDEX "practice_blocks_practice_id_idx" ON "public"."practice_blocks"("practice_id" ASC);

-- CreateIndex
CREATE INDEX "practices_coach_id_idx" ON "public"."practices"("coach_id" ASC);

-- CreateIndex
CREATE INDEX "practices_practice_date_idx" ON "public"."practices"("practice_date" ASC);

-- CreateIndex
CREATE INDEX "practices_sport_idx" ON "public"."practices"("sport" ASC);

-- CreateIndex
CREATE INDEX "practices_team_id_idx" ON "public"."practices"("team_id" ASC);

-- CreateIndex
CREATE INDEX "program_companies_owner_id_idx" ON "public"."program_companies"("owner_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "program_companies_slug_key" ON "public"."program_companies"("slug" ASC);

-- CreateIndex
CREATE INDEX "program_owner_coach_links_coach_id_idx" ON "public"."program_owner_coach_links"("coach_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "program_owner_coach_links_owner_id_coach_id_key" ON "public"."program_owner_coach_links"("owner_id" ASC, "coach_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "program_owners_email_key" ON "public"."program_owners"("email" ASC);

-- CreateIndex
CREATE INDEX "program_owners_firebase_uid_idx" ON "public"."program_owners"("firebase_uid" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "program_owners_firebase_uid_key" ON "public"."program_owners"("firebase_uid" ASC);

-- CreateIndex
CREATE INDEX "race_announcements_raceId_idx" ON "public"."race_announcements"("raceId" ASC);

-- CreateIndex
CREATE INDEX "race_announcements_staffGeneratedId_idx" ON "public"."race_announcements"("staffGeneratedId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "race_event_rsvps_eventId_athleteId_key" ON "public"."race_event_rsvps"("eventId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "race_events_date_idx" ON "public"."race_events"("date" ASC);

-- CreateIndex
CREATE INDEX "race_events_raceId_idx" ON "public"."race_events"("raceId" ASC);

-- CreateIndex
CREATE INDEX "race_memberships_athleteId_idx" ON "public"."race_memberships"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "race_memberships_raceId_athleteId_key" ON "public"."race_memberships"("raceId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "race_memberships_raceId_idx" ON "public"."race_memberships"("raceId" ASC);

-- CreateIndex
CREATE INDEX "race_messages_athleteId_idx" ON "public"."race_messages"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "race_messages_raceId_idx" ON "public"."race_messages"("raceId" ASC);

-- CreateIndex
CREATE INDEX "race_registry_city_state_idx" ON "public"."race_registry"("city" ASC, "state" ASC);

-- CreateIndex
CREATE INDEX "race_registry_companyRaceId_idx" ON "public"."race_registry"("companyRaceId" ASC);

-- CreateIndex
CREATE INDEX "race_registry_companyRegistrationId_idx" ON "public"."race_registry"("companyRegistrationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "race_registry_companyRegistrationId_key" ON "public"."race_registry"("companyRegistrationId" ASC);

-- CreateIndex
CREATE INDEX "race_registry_isActive_idx" ON "public"."race_registry"("isActive" ASC);

-- CreateIndex
CREATE INDEX "race_registry_parentRaceId_idx" ON "public"."race_registry"("parentRaceId" ASC);

-- CreateIndex
CREATE INDEX "race_registry_raceDate_idx" ON "public"."race_registry"("raceDate" ASC);

-- CreateIndex
CREATE INDEX "race_registry_slug_idx" ON "public"."race_registry"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "race_registry_slug_key" ON "public"."race_registry"("slug" ASC);

-- CreateIndex
CREATE INDEX "race_registry_tags_idx" ON "public"."race_registry"("tags" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "race_registry_course_segments_companySegmentId_key" ON "public"."race_registry_course_segments"("companySegmentId" ASC);

-- CreateIndex
CREATE INDEX "race_registry_course_segments_raceRegistryId_idx" ON "public"."race_registry_course_segments"("raceRegistryId" ASC);

-- CreateIndex
CREATE INDEX "routes_gofastCity_idx" ON "public"."routes"("gofastCity" ASC);

-- CreateIndex
CREATE INDEX "routes_name_idx" ON "public"."routes"("name" ASC);

-- CreateIndex
CREATE INDEX "run_club_announcements_runClubId_publishedAt_idx" ON "public"."run_club_announcements"("runClubId" ASC, "publishedAt" ASC);

-- CreateIndex
CREATE INDEX "run_club_event_rsvps_athleteId_idx" ON "public"."run_club_event_rsvps"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_club_event_rsvps_eventId_athleteId_key" ON "public"."run_club_event_rsvps"("eventId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "run_club_events_runClubId_startsAt_idx" ON "public"."run_club_events"("runClubId" ASC, "startsAt" ASC);

-- CreateIndex
CREATE INDEX "run_club_memberships_athleteId_idx" ON "public"."run_club_memberships"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_club_memberships_runClubId_athleteId_key" ON "public"."run_club_memberships"("runClubId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "run_club_memberships_runClubId_idx" ON "public"."run_club_memberships"("runClubId" ASC);

-- CreateIndex
CREATE INDEX "run_clubs_brandId_idx" ON "public"."run_clubs"("brandId" ASC);

-- CreateIndex
CREATE INDEX "run_clubs_city_idx" ON "public"."run_clubs"("city" ASC);

-- CreateIndex
CREATE INDEX "run_clubs_slug_idx" ON "public"."run_clubs"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_clubs_slug_key" ON "public"."run_clubs"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_crew_event_rsvps_eventId_athleteId_key" ON "public"."run_crew_event_rsvps"("eventId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "run_crew_events_date_idx" ON "public"."run_crew_events"("date" ASC);

-- CreateIndex
CREATE INDEX "run_crew_events_runCrewId_idx" ON "public"."run_crew_events"("runCrewId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_crew_memberships_runCrewId_athleteId_key" ON "public"."run_crew_memberships"("runCrewId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "run_crew_memberships_runCrewId_role_idx" ON "public"."run_crew_memberships"("runCrewId" ASC, "role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_crew_specific_races_runCrewId_raceRegistryId_key" ON "public"."run_crew_specific_races"("runCrewId" ASC, "raceRegistryId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_crews_handle_key" ON "public"."run_crews"("handle" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_crews_joinCode_key" ON "public"."run_crews"("joinCode" ASC);

-- CreateIndex
CREATE INDEX "run_journal_entries_athleteId_date_idx" ON "public"."run_journal_entries"("athleteId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "run_journal_entries_athleteId_idx" ON "public"."run_journal_entries"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "run_locations_gofastCity_idx" ON "public"."run_locations"("gofastCity" ASC);

-- CreateIndex
CREATE INDEX "run_locations_slug_idx" ON "public"."run_locations"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_locations_slug_key" ON "public"."run_locations"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_parents_email_key" ON "public"."run_parents"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_parents_firebase_uid_key" ON "public"."run_parents"("firebase_uid" ASC);

-- CreateIndex
CREATE INDEX "run_program_memberships_coach_id_idx" ON "public"."run_program_memberships"("coach_id" ASC);

-- CreateIndex
CREATE INDEX "run_program_memberships_run_parent_id_idx" ON "public"."run_program_memberships"("run_parent_id" ASC);

-- CreateIndex
CREATE INDEX "run_program_memberships_season_club_id_idx" ON "public"."run_program_memberships"("season_club_id" ASC);

-- CreateIndex
CREATE INDEX "run_program_memberships_young_athlete_id_idx" ON "public"."run_program_memberships"("young_athlete_id" ASC);

-- CreateIndex
CREATE INDEX "run_program_satellites_created_by_coach_id_idx" ON "public"."run_program_satellites"("created_by_coach_id" ASC);

-- CreateIndex
CREATE INDEX "run_program_satellites_run_program_id_idx" ON "public"."run_program_satellites"("run_program_id" ASC);

-- CreateIndex
CREATE INDEX "run_program_sessions_season_club_id_idx" ON "public"."run_program_sessions"("season_club_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_program_sessions_season_club_id_week_number_key" ON "public"."run_program_sessions"("season_club_id" ASC, "week_number" ASC);

-- CreateIndex
CREATE INDEX "run_program_sessions_session_date_idx" ON "public"."run_program_sessions"("session_date" ASC);

-- CreateIndex
CREATE INDEX "run_programs_company_id_idx" ON "public"."run_programs"("company_id" ASC);

-- CreateIndex
CREATE INDEX "run_programs_created_by_coach_id_idx" ON "public"."run_programs"("created_by_coach_id" ASC);

-- CreateIndex
CREATE INDEX "run_programs_owner_id_idx" ON "public"."run_programs"("owner_id" ASC);

-- CreateIndex
CREATE INDEX "run_programs_run_program_lead_id_idx" ON "public"."run_programs"("run_program_lead_id" ASC);

-- CreateIndex
CREATE INDEX "run_programs_slug_idx" ON "public"."run_programs"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_programs_slug_key" ON "public"."run_programs"("slug" ASC);

-- CreateIndex
CREATE INDEX "run_series_dayOfWeek_idx" ON "public"."run_series"("dayOfWeek" ASC);

-- CreateIndex
CREATE INDEX "run_series_gofastCity_idx" ON "public"."run_series"("gofastCity" ASC);

-- CreateIndex
CREATE INDEX "run_series_runClubId_idx" ON "public"."run_series"("runClubId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "run_series_slug_key" ON "public"."run_series"("slug" ASC);

-- CreateIndex
CREATE INDEX "run_series_workflowStatus_idx" ON "public"."run_series"("workflowStatus" ASC);

-- CreateIndex
CREATE INDEX "scheduled_runs_athleteId_date_idx" ON "public"."scheduled_runs"("athleteId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "scheduled_runs_athleteId_idx" ON "public"."scheduled_runs"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_runs_shareSlug_key" ON "public"."scheduled_runs"("shareSlug" ASC);

-- CreateIndex
CREATE INDEX "scheduled_runs_workoutId_idx" ON "public"."scheduled_runs"("workoutId" ASC);

-- CreateIndex
CREATE INDEX "season_clubs_join_code_idx" ON "public"."season_clubs"("join_code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "season_clubs_join_code_key" ON "public"."season_clubs"("join_code" ASC);

-- CreateIndex
CREATE INDEX "season_clubs_run_program_satellite_id_idx" ON "public"."season_clubs"("run_program_satellite_id" ASC);

-- CreateIndex
CREATE INDEX "sport_activities_activity_type_idx" ON "public"."sport_activities"("activity_type" ASC);

-- CreateIndex
CREATE INDEX "sport_activities_focus_area_idx" ON "public"."sport_activities"("focus_area" ASC);

-- CreateIndex
CREATE INDEX "sport_activities_name_idx" ON "public"."sport_activities"("name" ASC);

-- CreateIndex
CREATE INDEX "sport_activities_player_format_idx" ON "public"."sport_activities"("player_format" ASC);

-- CreateIndex
CREATE INDEX "sport_activities_sport_idx" ON "public"."sport_activities"("sport" ASC);

-- CreateIndex
CREATE INDEX "swim_workout_athleteId_date_idx" ON "public"."swim_workout"("athleteId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "swim_workout_athleteId_idx" ON "public"."swim_workout"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "swim_workout_step_swimWorkoutId_idx" ON "public"."swim_workout_step"("swimWorkoutId" ASC);

-- CreateIndex
CREATE INDEX "swim_workout_step_swimWorkoutId_stepOrder_idx" ON "public"."swim_workout_step"("swimWorkoutId" ASC, "stepOrder" ASC);

-- CreateIndex
CREATE INDEX "team_memberships_coach_id_idx" ON "public"."team_memberships"("coach_id" ASC);

-- CreateIndex
CREATE INDEX "team_memberships_run_parent_id_idx" ON "public"."team_memberships"("run_parent_id" ASC);

-- CreateIndex
CREATE INDEX "team_memberships_team_id_idx" ON "public"."team_memberships"("team_id" ASC);

-- CreateIndex
CREATE INDEX "team_memberships_young_athlete_id_idx" ON "public"."team_memberships"("young_athlete_id" ASC);

-- CreateIndex
CREATE INDEX "team_seasons_team_id_idx" ON "public"."team_seasons"("team_id" ASC);

-- CreateIndex
CREATE INDEX "teams_coach_id_idx" ON "public"."teams"("coach_id" ASC);

-- CreateIndex
CREATE INDEX "teams_join_code_idx" ON "public"."teams"("join_code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "teams_join_code_key" ON "public"."teams"("join_code" ASC);

-- CreateIndex
CREATE INDEX "teams_slug_idx" ON "public"."teams"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "teams_slug_key" ON "public"."teams"("slug" ASC);

-- CreateIndex
CREATE INDEX "tempo_config_name_idx" ON "public"."tempo_config"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tempo_config_position_tempoConfigId_cyclePosition_key" ON "public"."tempo_config_position"("tempoConfigId" ASC, "cyclePosition" ASC);

-- CreateIndex
CREATE INDEX "tempo_config_position_tempoConfigId_idx" ON "public"."tempo_config_position"("tempoConfigId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_announcements_cohortId_idx" ON "public"."training_cohort_announcements"("cohortId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_announcements_staffGeneratedId_idx" ON "public"."training_cohort_announcements"("staffGeneratedId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_memberships_athleteId_idx" ON "public"."training_cohort_memberships"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "training_cohort_memberships_cohortId_athleteId_key" ON "public"."training_cohort_memberships"("cohortId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_memberships_cohortId_idx" ON "public"."training_cohort_memberships"("cohortId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_memberships_raceId_athleteId_idx" ON "public"."training_cohort_memberships"("raceId" ASC, "athleteId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_memberships_trainingPlanId_idx" ON "public"."training_cohort_memberships"("trainingPlanId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "training_cohort_memberships_trainingPlanId_key" ON "public"."training_cohort_memberships"("trainingPlanId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_messages_athleteId_idx" ON "public"."training_cohort_messages"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "training_cohort_messages_cohortId_idx" ON "public"."training_cohort_messages"("cohortId" ASC);

-- CreateIndex
CREATE INDEX "training_cohorts_companyRaceId_idx" ON "public"."training_cohorts"("companyRaceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "training_cohorts_handle_key" ON "public"."training_cohorts"("handle" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "training_cohorts_joinCode_key" ON "public"."training_cohorts"("joinCode" ASC);

-- CreateIndex
CREATE INDEX "training_cohorts_presetId_idx" ON "public"."training_cohorts"("presetId" ASC);

-- CreateIndex
CREATE INDEX "training_cohorts_raceId_idx" ON "public"."training_cohorts"("raceId" ASC);

-- CreateIndex
CREATE INDEX "training_cohorts_status_idx" ON "public"."training_cohorts"("status" ASC);

-- CreateIndex
CREATE INDEX "training_plan_preset_intervalsConfigId_idx" ON "public"."training_plan_preset"("intervalsConfigId" ASC);

-- CreateIndex
CREATE INDEX "training_plan_preset_longRunConfigId_idx" ON "public"."training_plan_preset"("longRunConfigId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_preset_slug_key" ON "public"."training_plan_preset"("slug" ASC);

-- CreateIndex
CREATE INDEX "training_plan_preset_tempoConfigId_idx" ON "public"."training_plan_preset"("tempoConfigId" ASC);

-- CreateIndex
CREATE INDEX "training_plans_athleteGoalId_idx" ON "public"."training_plans"("athleteGoalId" ASC);

-- CreateIndex
CREATE INDEX "training_plans_athleteId_lifecycleStatus_idx" ON "public"."training_plans"("athleteId" ASC, "lifecycleStatus" ASC);

-- CreateIndex
CREATE INDEX "training_plans_cohortId_idx" ON "public"."training_plans"("cohortId" ASC);

-- CreateIndex
CREATE INDEX "training_plans_presetId_idx" ON "public"."training_plans"("presetId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "training_preferences_athleteId_key" ON "public"."training_preferences"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "tri_workout_athleteId_date_idx" ON "public"."tri_workout"("athleteId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "tri_workout_athleteId_idx" ON "public"."tri_workout"("athleteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tri_workout_leg_bikeWorkoutId_key" ON "public"."tri_workout_leg"("bikeWorkoutId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tri_workout_leg_runWorkoutId_key" ON "public"."tri_workout_leg"("runWorkoutId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tri_workout_leg_swimWorkoutId_key" ON "public"."tri_workout_leg"("swimWorkoutId" ASC);

-- CreateIndex
CREATE INDEX "tri_workout_leg_triWorkoutId_idx" ON "public"."tri_workout_leg"("triWorkoutId" ASC);

-- CreateIndex
CREATE INDEX "tri_workout_leg_triWorkoutId_legOrder_idx" ON "public"."tri_workout_leg"("triWorkoutId" ASC, "legOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workout_catalogue_name_workoutType_key" ON "public"."workout_catalogue"("name" ASC, "workoutType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workout_catalogue_slug_key" ON "public"."workout_catalogue"("slug" ASC);

-- CreateIndex
CREATE INDEX "workout_catalogue_workoutType_idx" ON "public"."workout_catalogue"("workoutType" ASC);

-- CreateIndex
CREATE INDEX "workout_segment_laps_activityId_idx" ON "public"."workout_segment_laps"("activityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workout_segment_laps_activityId_lapIndex_key" ON "public"."workout_segment_laps"("activityId" ASC, "lapIndex" ASC);

-- CreateIndex
CREATE INDEX "workout_segment_laps_segmentId_idx" ON "public"."workout_segment_laps"("segmentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workout_segment_laps_segmentId_lapIndex_key" ON "public"."workout_segment_laps"("segmentId" ASC, "lapIndex" ASC);

-- CreateIndex
CREATE INDEX "workout_segments_workoutId_idx" ON "public"."workout_segments"("workoutId" ASC);

-- CreateIndex
CREATE INDEX "workout_segments_workoutId_stepOrder_idx" ON "public"."workout_segments"("workoutId" ASC, "stepOrder" ASC);

-- CreateIndex
CREATE INDEX "workouts_athleteId_garminWorkoutId_idx" ON "public"."workouts"("athleteId" ASC, "garminWorkoutId" ASC);

-- CreateIndex
CREATE INDEX "workouts_athleteId_idx" ON "public"."workouts"("athleteId" ASC);

-- CreateIndex
CREATE INDEX "workouts_catalogueWorkoutId_idx" ON "public"."workouts"("catalogueWorkoutId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workouts_matchedActivityId_key" ON "public"."workouts"("matchedActivityId" ASC);

-- CreateIndex
CREATE INDEX "workouts_planId_date_idx" ON "public"."workouts"("planId" ASC, "date" ASC);

-- CreateIndex
CREATE INDEX "workouts_planId_idx" ON "public"."workouts"("planId" ASC);

-- CreateIndex
CREATE INDEX "workouts_planId_nOffset_idx" ON "public"."workouts"("planId" ASC, "nOffset" ASC);

-- CreateIndex
CREATE INDEX "workouts_planId_weekNumber_idx" ON "public"."workouts"("planId" ASC, "weekNumber" ASC);

-- CreateIndex
CREATE INDEX "workouts_runClubId_idx" ON "public"."workouts"("runClubId" ASC);

-- CreateIndex
CREATE INDEX "workouts_scope_idx" ON "public"."workouts"("scope" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "workouts_slug_key" ON "public"."workouts"("slug" ASC);

-- CreateIndex
CREATE INDEX "workouts_workoutType_idx" ON "public"."workouts"("workoutType" ASC);

-- CreateIndex
CREATE INDEX "young_athletes_run_parent_id_idx" ON "public"."young_athletes"("run_parent_id" ASC);

-- CreateIndex
CREATE INDEX "young_athletes_secondary_run_parent_id_idx" ON "public"."young_athletes"("secondary_run_parent_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."Athlete" ADD CONSTRAINT "Athlete_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."go_fast_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Athlete" ADD CONSTRAINT "Athlete_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "public"."run_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ambassador_credits" ADD CONSTRAINT "ambassador_credits_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ambassador_credits" ADD CONSTRAINT "ambassador_credits_cityRunRsvpId_fkey" FOREIGN KEY ("cityRunRsvpId") REFERENCES "public"."city_run_rsvps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ambassador_payouts" ADD CONSTRAINT "ambassador_payouts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."appnotification_deliveries" ADD CONSTRAINT "appnotification_deliveries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_activities" ADD CONSTRAINT "athlete_activities_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_appnotification_devices" ADD CONSTRAINT "athlete_appnotification_devices_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_goals" ADD CONSTRAINT "athlete_goals_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_goals" ADD CONSTRAINT "athlete_goals_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "public"."race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_health_records" ADD CONSTRAINT "athlete_health_records_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_results" ADD CONSTRAINT "athlete_race_results_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_results" ADD CONSTRAINT "athlete_race_results_garminActivityId_fkey" FOREIGN KEY ("garminActivityId") REFERENCES "public"."athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_results" ADD CONSTRAINT "athlete_race_results_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "public"."athlete_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_results" ADD CONSTRAINT "athlete_race_results_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_results" ADD CONSTRAINT "athlete_race_results_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "public"."athlete_race_signups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_signups" ADD CONSTRAINT "athlete_race_signups_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_signups" ADD CONSTRAINT "athlete_race_signups_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "public"."athlete_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."athlete_race_signups" ADD CONSTRAINT "athlete_race_signups_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bike_workout" ADD CONSTRAINT "bike_workout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bike_workout" ADD CONSTRAINT "bike_workout_matchedActivityId_fkey" FOREIGN KEY ("matchedActivityId") REFERENCES "public"."athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bike_workout_step" ADD CONSTRAINT "bike_workout_step_bikeWorkoutId_fkey" FOREIGN KEY ("bikeWorkoutId") REFERENCES "public"."bike_workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_activity_links" ADD CONSTRAINT "city_run_activity_links_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_activity_links" ADD CONSTRAINT "city_run_activity_links_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_activity_links" ADD CONSTRAINT "city_run_activity_links_cityRunId_fkey" FOREIGN KEY ("cityRunId") REFERENCES "public"."city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_checkins" ADD CONSTRAINT "city_run_checkins_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_checkins" ADD CONSTRAINT "city_run_checkins_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_messages" ADD CONSTRAINT "city_run_messages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_messages" ADD CONSTRAINT "city_run_messages_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_rsvps" ADD CONSTRAINT "run_crew_run_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_run_rsvps" ADD CONSTRAINT "run_crew_run_rsvps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."city_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "city_runs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."run_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "city_runs_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "public"."race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "city_runs_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "public"."routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "city_runs_runSeriesId_fkey" FOREIGN KEY ("runSeriesId") REFERENCES "public"."run_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "city_runs_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "public"."workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "run_crew_runs_athleteGeneratedId_fkey" FOREIGN KEY ("athleteGeneratedId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "run_crew_runs_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "public"."run_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."city_runs" ADD CONSTRAINT "run_crew_runs_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "public"."run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coach_event_volunteer_jobs" ADD CONSTRAINT "coach_event_volunteer_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."coach_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coach_event_volunteer_signups" ADD CONSTRAINT "coach_event_volunteer_signups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."coach_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coach_event_volunteer_signups" ADD CONSTRAINT "coach_event_volunteer_signups_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."coach_event_volunteer_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coach_events" ADD CONSTRAINT "coach_events_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coach_events" ADD CONSTRAINT "coach_events_season_club_id_fkey" FOREIGN KEY ("season_club_id") REFERENCES "public"."season_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coach_events" ADD CONSTRAINT "coach_events_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coaches" ADD CONSTRAINT "coaches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."go_fast_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."easy_config_position" ADD CONSTRAINT "easy_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "public"."workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."easy_config_position" ADD CONSTRAINT "easy_config_position_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "public"."easy_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gofast_container_memberships" ADD CONSTRAINT "gofast_container_memberships_containerAthleteId_fkey" FOREIGN KEY ("containerAthleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gofast_container_memberships" ADD CONSTRAINT "gofast_container_memberships_memberAthleteId_fkey" FOREIGN KEY ("memberAthleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gofast_container_messages" ADD CONSTRAINT "gofast_container_messages_authorAthleteId_fkey" FOREIGN KEY ("authorAthleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gofast_container_messages" ADD CONSTRAINT "gofast_container_messages_containerAthleteId_fkey" FOREIGN KEY ("containerAthleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."intervals_config_position" ADD CONSTRAINT "intervals_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "public"."workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."intervals_config_position" ADD CONSTRAINT "intervals_config_position_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "public"."intervals_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."join_codes" ADD CONSTRAINT "join_codes_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "public"."run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."levelup_workout_segments" ADD CONSTRAINT "levelup_workout_segments_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "public"."levelup_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."levelup_workouts" ADD CONSTRAINT "levelup_workouts_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."levelup_workouts" ADD CONSTRAINT "levelup_workouts_run_program_session_id_fkey" FOREIGN KEY ("run_program_session_id") REFERENCES "public"."run_program_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."levelup_workouts" ADD CONSTRAINT "levelup_workouts_season_club_id_fkey" FOREIGN KEY ("season_club_id") REFERENCES "public"."season_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."levelup_workouts" ADD CONSTRAINT "levelup_workouts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."long_run_config_position" ADD CONSTRAINT "long_run_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "public"."workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."long_run_config_position" ADD CONSTRAINT "long_run_config_position_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "public"."long_run_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pace_adjustment_log" ADD CONSTRAINT "pace_adjustment_log_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pace_adjustment_log" ADD CONSTRAINT "pace_adjustment_log_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_assessments" ADD CONSTRAINT "player_assessments_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_assessments" ADD CONSTRAINT "player_assessments_season_club_id_fkey" FOREIGN KEY ("season_club_id") REFERENCES "public"."season_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_assessments" ADD CONSTRAINT "player_assessments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."player_assessments" ADD CONSTRAINT "player_assessments_young_athlete_id_fkey" FOREIGN KEY ("young_athlete_id") REFERENCES "public"."young_athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practice_block_activities" ADD CONSTRAINT "practice_block_activities_practice_block_id_fkey" FOREIGN KEY ("practice_block_id") REFERENCES "public"."practice_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practice_block_activities" ADD CONSTRAINT "practice_block_activities_sport_activity_id_fkey" FOREIGN KEY ("sport_activity_id") REFERENCES "public"."sport_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practice_blocks" ADD CONSTRAINT "practice_blocks_practice_id_fkey" FOREIGN KEY ("practice_id") REFERENCES "public"."practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practices" ADD CONSTRAINT "practices_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."practices" ADD CONSTRAINT "practices_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_companies" ADD CONSTRAINT "program_companies_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."program_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_owner_coach_links" ADD CONSTRAINT "program_owner_coach_links_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."program_owner_coach_links" ADD CONSTRAINT "program_owner_coach_links_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."program_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_announcements" ADD CONSTRAINT "race_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_announcements" ADD CONSTRAINT "race_announcements_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_event_rsvps" ADD CONSTRAINT "race_event_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_event_rsvps" ADD CONSTRAINT "race_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."race_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_events" ADD CONSTRAINT "race_events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_events" ADD CONSTRAINT "race_events_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_memberships" ADD CONSTRAINT "race_memberships_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_memberships" ADD CONSTRAINT "race_memberships_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_messages" ADD CONSTRAINT "race_messages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_messages" ADD CONSTRAINT "race_messages_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_registry" ADD CONSTRAINT "race_registry_parentRaceId_fkey" FOREIGN KEY ("parentRaceId") REFERENCES "public"."race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."race_registry_course_segments" ADD CONSTRAINT "race_registry_course_segments_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."routes" ADD CONSTRAINT "routes_createdByAthleteId_fkey" FOREIGN KEY ("createdByAthleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_announcements" ADD CONSTRAINT "run_club_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_announcements" ADD CONSTRAINT "run_club_announcements_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "public"."run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_event_rsvps" ADD CONSTRAINT "run_club_event_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_event_rsvps" ADD CONSTRAINT "run_club_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."run_club_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_events" ADD CONSTRAINT "run_club_events_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_events" ADD CONSTRAINT "run_club_events_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "public"."run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_memberships" ADD CONSTRAINT "run_club_memberships_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_club_memberships" ADD CONSTRAINT "run_club_memberships_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "public"."run_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_clubs" ADD CONSTRAINT "run_clubs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "public"."brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_announcements" ADD CONSTRAINT "run_crew_announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_announcements" ADD CONSTRAINT "run_crew_announcements_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "public"."run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_event_rsvps" ADD CONSTRAINT "run_crew_event_rsvps_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_event_rsvps" ADD CONSTRAINT "run_crew_event_rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."run_crew_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_events" ADD CONSTRAINT "run_crew_events_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_events" ADD CONSTRAINT "run_crew_events_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "public"."run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_memberships" ADD CONSTRAINT "run_crew_memberships_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_memberships" ADD CONSTRAINT "run_crew_memberships_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "public"."run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_messages" ADD CONSTRAINT "run_crew_messages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_messages" ADD CONSTRAINT "run_crew_messages_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "public"."run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_specific_races" ADD CONSTRAINT "run_crew_specific_races_raceRegistryId_fkey" FOREIGN KEY ("raceRegistryId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crew_specific_races" ADD CONSTRAINT "run_crew_specific_races_runCrewId_fkey" FOREIGN KEY ("runCrewId") REFERENCES "public"."run_crews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_crews" ADD CONSTRAINT "run_crews_trainingForRace_fkey" FOREIGN KEY ("trainingForRace") REFERENCES "public"."race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_journal_entries" ADD CONSTRAINT "run_journal_entries_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_program_memberships" ADD CONSTRAINT "run_program_memberships_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_program_memberships" ADD CONSTRAINT "run_program_memberships_run_parent_id_fkey" FOREIGN KEY ("run_parent_id") REFERENCES "public"."run_parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_program_memberships" ADD CONSTRAINT "run_program_memberships_season_club_id_fkey" FOREIGN KEY ("season_club_id") REFERENCES "public"."season_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_program_memberships" ADD CONSTRAINT "run_program_memberships_young_athlete_id_fkey" FOREIGN KEY ("young_athlete_id") REFERENCES "public"."young_athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_program_satellites" ADD CONSTRAINT "run_program_satellites_created_by_coach_id_fkey" FOREIGN KEY ("created_by_coach_id") REFERENCES "public"."coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_program_satellites" ADD CONSTRAINT "run_program_satellites_run_program_id_fkey" FOREIGN KEY ("run_program_id") REFERENCES "public"."run_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_program_sessions" ADD CONSTRAINT "run_program_sessions_season_club_id_fkey" FOREIGN KEY ("season_club_id") REFERENCES "public"."season_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_programs" ADD CONSTRAINT "run_programs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."program_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_programs" ADD CONSTRAINT "run_programs_created_by_coach_id_fkey" FOREIGN KEY ("created_by_coach_id") REFERENCES "public"."coach"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_programs" ADD CONSTRAINT "run_programs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."program_owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."run_series" ADD CONSTRAINT "city_run_setups_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "public"."run_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheduled_runs" ADD CONSTRAINT "scheduled_runs_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."scheduled_runs" ADD CONSTRAINT "scheduled_runs_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "public"."workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_clubs" ADD CONSTRAINT "season_clubs_run_program_satellite_id_fkey" FOREIGN KEY ("run_program_satellite_id") REFERENCES "public"."run_program_satellites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."swim_workout" ADD CONSTRAINT "swim_workout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."swim_workout_step" ADD CONSTRAINT "swim_workout_step_swimWorkoutId_fkey" FOREIGN KEY ("swimWorkoutId") REFERENCES "public"."swim_workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_memberships" ADD CONSTRAINT "team_memberships_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_memberships" ADD CONSTRAINT "team_memberships_run_parent_id_fkey" FOREIGN KEY ("run_parent_id") REFERENCES "public"."run_parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_memberships" ADD CONSTRAINT "team_memberships_young_athlete_id_fkey" FOREIGN KEY ("young_athlete_id") REFERENCES "public"."young_athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_seasons" ADD CONSTRAINT "team_seasons_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teams" ADD CONSTRAINT "teams_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tempo_config_position" ADD CONSTRAINT "tempo_config_position_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "public"."workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tempo_config_position" ADD CONSTRAINT "tempo_config_position_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "public"."tempo_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohort_announcements" ADD CONSTRAINT "training_cohort_announcements_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."training_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohort_memberships" ADD CONSTRAINT "training_cohort_memberships_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohort_memberships" ADD CONSTRAINT "training_cohort_memberships_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."training_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohort_memberships" ADD CONSTRAINT "training_cohort_memberships_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."race_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohort_memberships" ADD CONSTRAINT "training_cohort_memberships_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "public"."training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohort_messages" ADD CONSTRAINT "training_cohort_messages_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohort_messages" ADD CONSTRAINT "training_cohort_messages_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."training_cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohorts" ADD CONSTRAINT "training_cohorts_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "public"."training_plan_preset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_cohorts" ADD CONSTRAINT "training_cohorts_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."race_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plan_preset" ADD CONSTRAINT "training_plan_preset_easyConfigId_fkey" FOREIGN KEY ("easyConfigId") REFERENCES "public"."easy_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plan_preset" ADD CONSTRAINT "training_plan_preset_intervalsConfigId_fkey" FOREIGN KEY ("intervalsConfigId") REFERENCES "public"."intervals_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plan_preset" ADD CONSTRAINT "training_plan_preset_longRunConfigId_fkey" FOREIGN KEY ("longRunConfigId") REFERENCES "public"."long_run_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plan_preset" ADD CONSTRAINT "training_plan_preset_tempoConfigId_fkey" FOREIGN KEY ("tempoConfigId") REFERENCES "public"."tempo_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plans" ADD CONSTRAINT "training_plans_athleteGoalId_fkey" FOREIGN KEY ("athleteGoalId") REFERENCES "public"."athlete_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plans" ADD CONSTRAINT "training_plans_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plans" ADD CONSTRAINT "training_plans_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."training_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plans" ADD CONSTRAINT "training_plans_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "public"."training_plan_preset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_plans" ADD CONSTRAINT "training_plans_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."race_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."training_preferences" ADD CONSTRAINT "training_preferences_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tri_workout" ADD CONSTRAINT "tri_workout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_bikeWorkoutId_fkey" FOREIGN KEY ("bikeWorkoutId") REFERENCES "public"."bike_workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_runWorkoutId_fkey" FOREIGN KEY ("runWorkoutId") REFERENCES "public"."workouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_swimWorkoutId_fkey" FOREIGN KEY ("swimWorkoutId") REFERENCES "public"."swim_workout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tri_workout_leg" ADD CONSTRAINT "tri_workout_leg_triWorkoutId_fkey" FOREIGN KEY ("triWorkoutId") REFERENCES "public"."tri_workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_segment_laps" ADD CONSTRAINT "workout_segment_laps_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."athlete_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_segment_laps" ADD CONSTRAINT "workout_segment_laps_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "public"."workout_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workout_segments" ADD CONSTRAINT "workout_segments_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "public"."workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workouts" ADD CONSTRAINT "workouts_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "public"."Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workouts" ADD CONSTRAINT "workouts_catalogueWorkoutId_fkey" FOREIGN KEY ("catalogueWorkoutId") REFERENCES "public"."workout_catalogue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workouts" ADD CONSTRAINT "workouts_matchedActivityId_fkey" FOREIGN KEY ("matchedActivityId") REFERENCES "public"."athlete_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workouts" ADD CONSTRAINT "workouts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."training_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workouts" ADD CONSTRAINT "workouts_runClubId_fkey" FOREIGN KEY ("runClubId") REFERENCES "public"."run_clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."young_athletes" ADD CONSTRAINT "young_athletes_run_parent_id_fkey" FOREIGN KEY ("run_parent_id") REFERENCES "public"."run_parents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."young_athletes" ADD CONSTRAINT "young_athletes_secondary_run_parent_id_fkey" FOREIGN KEY ("secondary_run_parent_id") REFERENCES "public"."run_parents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
