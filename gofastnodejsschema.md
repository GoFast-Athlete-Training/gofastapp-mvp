# GoFast Node.js Database Schema - Source of Truth

**Last Updated**: January 2025  
**Source**: `gofastbackendv2-fall2025/prisma/schema.prisma`  
**Purpose**: Complete schema documentation for database rebuild

---

## Table of Contents

1. [Core Identity Models](#core-identity-models)
2. [RunCrew Models](#runcrew-models)
3. [Activity Models](#activity-models)
4. [Event Models](#event-models)
5. [Training Models](#training-models)
6. [Founder Models](#founder-models)
7. [Company Models](#company-models)
8. [Parent & Young Athlete Models](#parent--young-athlete-models)
9. [F3 Workout Models](#f3-workout-models)
10. [Key Relationships](#key-relationships)
11. [Constraints & Indexes](#constraints--indexes)

---

## Core Identity Models

### Athlete

**Table**: `athletes`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `firebaseId`, `email`, `garmin_user_id`, `strava_id`, `gofastHandle`

**Core Fields**:
- `id` - Primary identifier (cuid)
- `firebaseId` - Firebase authentication ID (unique, required)
- `email` - Email address (unique, required)

**Universal Profile (MVP1 Required)**:
- `firstName` - String?
- `lastName` - String?
- `phoneNumber` - String?
- `gofastHandle` - String? (unique)
- `birthday` - DateTime?
- `gender` - String?
- `city` - String?
- `state` - String?
- `primarySport` - String?
- `photoURL` - String?
- `bio` - String?
- `instagram` - String?

**Training Profile (Future)**:
- `myCurrentPace` - String?
- `myWeeklyMileage` - Int?
- `myTrainingGoal` - String?
- `myTargetRace` - String?
- `myTrainingStartDate` - DateTime?

**Match Profile (Future)**:
- `preferredDistance` - String?
- `timePreference` - String?
- `myPaceRange` - String?
- `myRunningGoals` - String?

**Garmin OAuth 2.0 PKCE Integration**:
- `garmin_user_id` - String? (unique)
- `garmin_access_token` - String?
- `garmin_refresh_token` - String?
- `garmin_expires_in` - Int?
- `garmin_scope` - String?
- `garmin_connected_at` - DateTime?
- `garmin_last_sync_at` - DateTime?
- `garmin_permissions` - Json?
- `garmin_is_connected` - Boolean (default: false)
- `garmin_disconnected_at` - DateTime?
- `garmin_user_profile` - Json?
- `garmin_user_sleep` - Json?
- `garmin_user_preferences` - Json?

**Strava OAuth**:
- `strava_id` - Int? (unique)
- `strava_access_token` - String?
- `strava_refresh_token` - String?
- `strava_expires_at` - Int?

**System Fields**:
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)
- `status` - String?

**Relations**:
- `activities` - One-to-many: `AthleteActivity[]`
- `runCrewMemberships` - Many-to-many: `RunCrewMembership[]` (junction table)
- `runCrewMessages` - One-to-many: `RunCrewMessage[]`
- `runCrewAnnouncements` - One-to-many: `RunCrewAnnouncement[]`
- `runCrewRuns` - One-to-many: `RunCrewRun[]` (created runs)
- `runCrewRunRSVPs` - One-to-many: `RunCrewRunRSVP[]`
- `runCrewEvents` - One-to-many: `RunCrewEvent[]`
- `runCrewEventRSVPs` - One-to-many: `RunCrewEventRSVP[]`
- `runCrewManagers` - Many-to-many: `RunCrewManager[]` (admin/manager roles)
- `handleRegistry` - One-to-one: `HandleRegistry?`
- `createdRaces` - One-to-many: `Race[]`
- `trainingPlans` - One-to-many: `TrainingPlan[]`
- `plannedDays` - One-to-many: `TrainingDayPlanned[]`
- `executedDays` - One-to-many: `TrainingDayExecuted[]`
- `events` - One-to-many: `Event[]` (created events)
- `founder` - One-to-one: `Founder?` (optional extension)

**Key Design**:
- Athlete is the **source of truth** for all identity
- Supports multiple RunCrew memberships via junction table
- Admin/manager roles determined via `RunCrewManager` table (not direct field)
- All cascade deletes when athlete is deleted

---

## RunCrew Models

### RunCrew

**Table**: `run_crews`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `joinCode`

**Fields**:
- `id` - Primary identifier (cuid)
- `name` - String (required)
- `description` - String?
- `joinCode` - String (unique, required) - Backward compatibility
- `logo` - String?
- `icon` - String? (emoji/icon alternative to logo)
- `isArchived` - Boolean (default: false) - Soft delete
- `archivedAt` - DateTime?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `memberships` - One-to-many: `RunCrewMembership[]` (junction table)
- `messages` - One-to-many: `RunCrewMessage[]`
- `announcements` - One-to-many: `RunCrewAnnouncement[]`
- `runs` - One-to-many: `RunCrewRun[]`
- `events` - One-to-many: `RunCrewEvent[]`
- `managers` - One-to-many: `RunCrewManager[]` (admin/manager roles)
- `joinCodes` - One-to-many: `JoinCode[]` (authoritative invite codes)

**Key Design**:
- Admin status determined via `RunCrewManager` with `role='admin'`
- No direct `adminId` field (uses junction table)
- Supports soft delete via `isArchived`

### RunCrewMembership

**Table**: `run_crew_memberships`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[runCrewId, athleteId]` (composite)

**Fields**:
- `id` - Primary identifier (cuid)
- `runCrewId` - String (foreign key to RunCrew)
- `athleteId` - String (foreign key to Athlete)
- `joinedAt` - DateTime (default: now())
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `runCrew` - Many-to-one: `RunCrew`
- `athlete` - Many-to-one: `Athlete`

**Key Design**:
- **Junction table** for many-to-many relationship
- One membership per athlete per crew (enforced by unique constraint)
- Cascade delete when crew or athlete is deleted

### RunCrewManager

**Table**: `run_crew_managers`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[runCrewId, athleteId]` (composite)

**Fields**:
- `id` - Primary identifier (cuid)
- `runCrewId` - String (foreign key to RunCrew)
- `athleteId` - String (foreign key to Athlete)
- `role` - String (required) - "admin" or "manager"
- `createdAt` - DateTime (default: now())

**Relations**:
- `runCrew` - Many-to-one: `RunCrew`
- `athlete` - Many-to-one: `Athlete`

**Key Design**:
- **Source of truth** for admin/manager roles
- One role per athlete per crew
- Cascade delete when crew or athlete is deleted

### RunCrewMessage

**Table**: `run_crew_messages`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `runCrewId` - String (foreign key to RunCrew)
- `athleteId` - String (foreign key to Athlete - message author)
- `content` - String (required) - Message text only (no images/likes)
- `createdAt` - DateTime (default: now())

**Relations**:
- `runCrew` - Many-to-one: `RunCrew`
- `athlete` - Many-to-one: `Athlete`

### RunCrewAnnouncement

**Table**: `run_crew_announcements`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `runCrewId` - String (foreign key to RunCrew)
- `authorId` - String (foreign key to Athlete - admin who created it)
- `title` - String (required)
- `content` - String (required)
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `runCrew` - Many-to-one: `RunCrew`
- `author` - Many-to-one: `Athlete`

### RunCrewRun

**Table**: `run_crew_runs`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `runCrewId` - String (foreign key to RunCrew)
- `createdById` - String (foreign key to Athlete - admin/manager who created)
- `title` - String (required)
- `runType` - String (default: "single") - "single" | "recurring"
- `date` - DateTime (required) - Start date for single run or first occurrence
- `startTime` - String (required) - "06:30 AM" (human-readable)
- `timezone` - String? - IANA timezone ("America/Chicago")
- `meetUpPoint` - String (required)
- `meetUpAddress` - String?
- `meetUpPlaceId` - String?
- `meetUpLat` - Float?
- `meetUpLng` - Float?
- `recurrenceRule` - String? - Future recurrence support
- `recurrenceEndsOn` - DateTime?
- `recurrenceNote` - String?
- `totalMiles` - Float?
- `pace` - String? - Target pace (e.g., "8:00-9:00 min/mile")
- `stravaMapUrl` - String?
- `description` - String?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `runCrew` - Many-to-one: `RunCrew`
- `createdBy` - Many-to-one: `Athlete`
- `rsvps` - One-to-many: `RunCrewRunRSVP[]`

### RunCrewRunRSVP

**Table**: `run_crew_run_rsvps`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[runId, athleteId]` (composite)

**Fields**:
- `id` - Primary identifier (cuid)
- `runId` - String (foreign key to RunCrewRun)
- `athleteId` - String (foreign key to Athlete)
- `status` - String (required) - "going" | "maybe" | "not-going"
- `createdAt` - DateTime (default: now())

**Relations**:
- `run` - Many-to-one: `RunCrewRun`
- `athlete` - Many-to-one: `Athlete`

### RunCrewEvent

**Table**: `run_crew_events`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `runCrewId` - String (foreign key to RunCrew)
- `organizerId` - String (foreign key to Athlete)
- `title` - String (required)
- `date` - DateTime (required)
- `time` - String (required) - "6:00 PM"
- `location` - String (required)
- `address` - String?
- `description` - String?
- `eventType` - String? - "happy-hour", "social", "meetup", etc.
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `runCrew` - Many-to-one: `RunCrew`
- `organizer` - Many-to-one: `Athlete`
- `rsvps` - One-to-many: `RunCrewEventRSVP[]`

### RunCrewEventRSVP

**Table**: `run_crew_event_rsvps`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[eventId, athleteId]` (composite)

**Fields**:
- `id` - Primary identifier (cuid)
- `eventId` - String (foreign key to RunCrewEvent)
- `athleteId` - String (foreign key to Athlete)
- `status` - String (required) - "going" | "maybe" | "not-going"
- `createdAt` - DateTime (default: now())

**Relations**:
- `event` - Many-to-one: `RunCrewEvent`
- `athlete` - Many-to-one: `Athlete`

### JoinCode

**Table**: `join_codes`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `code`

**Fields**:
- `id` - Primary identifier (cuid)
- `code` - String (unique, required)
- `runCrewId` - String (foreign key to RunCrew)
- `createdAt` - DateTime (default: now())
- `expiresAt` - DateTime?
- `isActive` - Boolean (default: true)

**Relations**:
- `runCrew` - Many-to-one: `RunCrew`

**Key Design**:
- **Authoritative source** for crew invites
- Supports expiration and active/inactive status

---

## Activity Models

### AthleteActivity

**Table**: `athlete_activities`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `sourceActivityId`

**Fields**:
- `id` - Primary identifier (cuid)
- `athleteId` - String (foreign key to Athlete)
- `sourceActivityId` - String (unique, required) - Garmin's unique activity ID
- `source` - String (default: "garmin")

**Core Activity Data**:
- `activityType` - String? - running, cycling, swimming, etc.
- `activityName` - String? - "Morning Run", "Evening Bike Ride"
- `startTime` - DateTime?
- `duration` - Int? - Duration in seconds
- `distance` - Float? - Distance in meters
- `averageSpeed` - Float? - Average speed in m/s
- `calories` - Int?

**Performance Metrics**:
- `averageHeartRate` - Int?
- `maxHeartRate` - Int?
- `elevationGain` - Float? - Elevation gain in meters
- `steps` - Int?

**Location Data**:
- `startLatitude` - Float?
- `startLongitude` - Float?
- `endLatitude` - Float?
- `endLongitude` - Float?
- `summaryPolyline` - String? - Encoded route polyline

**Device Information**:
- `deviceName` - String? - "Forerunner 255", "Edge 1040"
- `garminUserId` - String? - Garmin user GUID from webhook

**Hybrid Data Storage**:
- `summaryData` - Json? - Phase 1: Summary fields from /garmin/activity
- `detailData` - Json? - Phase 2: Details from /garmin/details
- `hydratedAt` - DateTime? - When details were hydrated

**Timestamps**:
- `syncedAt` - DateTime (default: now())
- `lastUpdatedAt` - DateTime (default: now())
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `athlete` - Many-to-one: `Athlete` (cascade delete)
- `eventResults` - One-to-many: `EventResult[]` (legacy - parent's activity)

---

## Event Models

### Event

**Table**: `events`  
**Primary Key**: `id` (String, cuid)  
**Indexes**: `[athleteId]`, `[athleteId, title, date]` (for upsert lookup)

**Fields**:
- `id` - Primary identifier (cuid)
- `title` - String (required) - "Boys Gotta Run – Discovery 5K (Final Run)"
- `description` - String?
- `date` - DateTime (required)
- `startTime` - String? - "7:55 AM"
- `location` - String? - "Discovery Elementary"
- `address` - String? - "5275 N 36th St, Arlington, VA 22207"
- `stravaRouteUrl` - String? - Strava route URL
- `distance` - String? - "5K", "3.1 miles", "10K"
- `athleteId` - String (required) - Links to Athlete.id (creator)
- `registrantId` - String? - Future: Links to athleteId for main UX registration
- `eventType` - String? - "race", "community-run", "training", etc.
- `isActive` - Boolean (default: true)
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `athlete` - Many-to-one: `Athlete` (cascade delete)
- `volunteers` - One-to-many: `EventVolunteer[]`
- `registrations` - One-to-many: `EventRegistration[]`

### EventVolunteer

**Table**: `event_volunteers`  
**Primary Key**: `id` (String, cuid)  
**Indexes**: `[eventId]`

**Fields**:
- `id` - Primary identifier (cuid)
- `eventId` - String (foreign key to Event)
- `name` - String (required)
- `email` - String (required)
- `phone` - String? - Optional phone for group text
- `role` - String (required)
- `notes` - String?
- `createdAt` - DateTime (default: now())

**Relations**:
- `event` - Many-to-one: `Event` (cascade delete)

### EventRegistration

**Table**: `event_registrations`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[eventId, email]` (composite)  
**Indexes**: `[eventId]`

**Fields**:
- `id` - Primary identifier (cuid)
- `eventId` - String (foreign key to Event)
- `name` - String (required)
- `email` - String (required)
- `phone` - String?
- `notes` - String? - Emergency contact, t-shirt size, etc.
- `createdAt` - DateTime (default: now())

**Relations**:
- `event` - Many-to-one: `Event` (cascade delete)

---

## Training Models

### Race

**Table**: `races`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `raceName` - String (required)
- `raceType` - String (required) - 5k, 10k, 10m, half, marathon, other
- `raceDate` - DateTime (required)
- `location` - String?
- `distanceMiles` - Float (required)
- `registrationUrl` - String?
- `description` - String?
- `courseProfile` - Json? - { elevationGain, difficulty, surface, weather }
- `createdByAthleteId` - String? - Optional - some races created by admins
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `createdByAthlete` - Many-to-one: `Athlete?` (optional, set null on delete)
- `trainingPlans` - One-to-many: `TrainingPlan[]`

### TrainingPlan

**Table**: `training_plans`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `athleteId` - String (foreign key to Athlete)
- `raceId` - String (foreign key to Race)
- `trainingPlanName` - String (required)
- `trainingPlanGoalTime` - String (required) - "1:45:00"
- `trainingPlanGoalPace` - String? - "8:00" per mile
- `trainingPlanBaseline5k` - String (required) - "24:30"
- `trainingPlanBaselineWeeklyMileage` - Int?
- `trainingPlanStartDate` - DateTime (required)
- `trainingPlanTotalWeeks` - Int (required)
- `trainingPlanAdaptive5kTime` - String? - Only persistent predictive metric
- `status` - String (default: "draft") - draft, active, completed, archived
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `athlete` - Many-to-one: `Athlete` (cascade delete)
- `race` - Many-to-one: `Race` (cascade delete)
- `phases` - One-to-many: `TrainingPhase[]`
- `plannedDays` - One-to-many: `TrainingDayPlanned[]`
- `executions` - One-to-many: `TrainingPlanExecution[]`

### TrainingPhase

**Table**: `training_phases`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `trainingPlanId` - String (foreign key to TrainingPlan)
- `phaseName` - String (required) - "base", "build", "peak", "taper"
- `phaseIndex` - Int (required) - 0,1,2,3
- `startWeek` - Int (required)
- `endWeek` - Int (required)
- `metadata` - Json?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `trainingPlan` - Many-to-one: `TrainingPlan` (cascade delete)
- `plannedDays` - One-to-many: `TrainingDayPlanned[]`

### TrainingDayPlanned

**Table**: `training_days_planned`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[trainingPlanId, weekIndex, dayIndex]` (composite)

**Fields**:
- `id` - Primary identifier (cuid)
- `trainingPlanId` - String (foreign key to TrainingPlan)
- `trainingPhaseId` - String? (foreign key to TrainingPhase)
- `athleteId` - String (foreign key to Athlete)
- `date` - DateTime (required)
- `weekIndex` - Int (required) - 0-based
- `dayIndex` - Int (required) - 0-6 (Mon-Sun)
- `dayName` - String? - "Monday", "Tuesday", etc.
- `phase` - String (required) - base, build, peak, taper
- `plannedData` - Json (required) - { type, mileage, duration, paceRange, targetPace, hrZone, hrRange, segments, label, description, coachNotes }
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `trainingPlan` - Many-to-one: `TrainingPlan` (cascade delete)
- `trainingPhase` - Many-to-one: `TrainingPhase?` (set null on delete)
- `athlete` - Many-to-one: `Athlete` (cascade delete)

### TrainingPlanExecution

**Table**: `training_plan_executions`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `trainingPlanId` - String (foreign key to TrainingPlan)
- `startedAt` - DateTime (required)
- `status` - String (default: "active") - active, completed, cancelled
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `trainingPlan` - Many-to-one: `TrainingPlan` (cascade delete)
- `executedDays` - One-to-many: `TrainingDayExecuted[]`

### TrainingDayExecuted

**Table**: `training_days_executed`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[executionId, date]` (composite)  
**Unique Constraints**: `activityId` (optional link to AthleteActivity)

**Fields**:
- `id` - Primary identifier (cuid)
- `executionId` - String (foreign key to TrainingPlanExecution)
- `athleteId` - String (foreign key to Athlete)
- `activityId` - String? (unique) - Links to AthleteActivity.id
- `weekIndex` - Int (required)
- `dayIndex` - Int (required)
- `date` - DateTime (required)
- `plannedData` - Json? - Snapshot when executed
- `analysis` - Json? - { workoutCompleted, hitTargetMileage, hitTargetPace, stayedInHRZone, mileageVariance, paceVariance, qualityScore, performanceNotes }
- `feedback` - Json? - { mood, effort, injuryFlag, notes, submittedAt }
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `execution` - Many-to-one: `TrainingPlanExecution` (cascade delete)
- `athlete` - Many-to-one: `Athlete` (cascade delete)

---

## Founder Models

### Founder

**Table**: `founders`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `athleteId`

**Fields**:
- `id` - Primary identifier (cuid)
- `athleteId` - String (unique, foreign key to Athlete)
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `athlete` - One-to-one: `Athlete` (cascade delete)
- `tasks` - One-to-many: `FounderTask[]`
- `crmContacts` - One-to-many: `CrmContact[]`
- `roadmapItems` - One-to-many: `RoadmapItem[]`
- `companyFounders` - One-to-many: `CompanyFounder[]`
- `unifiedTasks` - One-to-many: `Task[]`

**Key Design**:
- Founder IS an athlete (links to Athlete)
- For GoFast Company employees/founders
- Separate concern from athlete identity

### FounderTask

**Table**: `founder_tasks`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `founderId` - String (foreign key to Founder)
- `title` - String (required)
- `description` - String?
- `status` - String (default: "pending") - pending, in_progress, completed, cancelled
- `priority` - String (default: "medium") - low, medium, high, urgent
- `dueDate` - DateTime?
- `completedAt` - DateTime?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `founder` - Many-to-one: `Founder` (cascade delete)

### CrmContact

**Table**: `crm_contacts`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `founderId` - String (foreign key to Founder)
- `name` - String (required)
- `role` - String? - "Founder @ AcmeAI", "CTO @ BetaCo", "Angel", etc.
- `email` - String?
- `company` - String?
- `pipeline` - String (required) - Founders, Collaborators, Funders, Advisors
- `status` - String (default: "New") - New, Warm, Active, Exploring, Cold
- `nextStep` - String? - "Coffee chat Thu", "Send 1-pager", "Bi-weekly sync"
- `notes` - String?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `founder` - Many-to-one: `Founder` (cascade delete)

### RoadmapItem

**Table**: `roadmap_items`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `founderId` - String (foreign key to Founder)
- `roadmapType` - String (required) - product, gtm, personal
- `quarter` - String? - "Q4 2025", "Q1 2026", "Q2 2026" (for product roadmap)
- `category` - String? - Mindset, Habits, Networking (for personal roadmap)
- `title` - String (required)
- `description` - String?
- `status` - String (default: "pending") - pending, in_progress, completed, cancelled
- `dueDate` - DateTime?
- `completedAt` - DateTime?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `founder` - Many-to-one: `Founder` (cascade delete)

---

## Company Models

### Company

**Table**: `companies`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `name` - String (required)
- `address` - String?
- `website` - String?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `founders` - One-to-many: `CompanyFounder[]`
- `employees` - One-to-many: `CompanyEmployee[]`
- `roadmapItems` - One-to-many: `CompanyRoadmapItem[]`
- `tasks` - One-to-many: `Task[]`
- `crmContacts` - One-to-many: `CompanyCrmContact[]`
- `financialSpends` - One-to-many: `CompanyFinancialSpend[]`
- `financialProjections` - One-to-many: `CompanyFinancialProjection[]`

### CompanyFounder

**Table**: `company_founders`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[companyId, founderId]` (composite)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String (foreign key to Company)
- `founderId` - String (foreign key to Founder)
- `role` - String? - "CEO", "Co-Founder"
- `joinedAt` - DateTime (default: now())

**Relations**:
- `company` - Many-to-one: `Company` (cascade delete)
- `founder` - Many-to-one: `Founder` (cascade delete)

### CompanyEmployee

**Table**: `company_employees`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[companyId, email]` (composite)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String (foreign key to Company)
- `email` - String (required)
- `name` - String (required)
- `role` - String? - "Engineer", "Designer", "PM"
- `department` - String?
- `phoneNumber` - String?
- `joinedAt` - DateTime (default: now())

**Relations**:
- `company` - Many-to-one: `Company` (cascade delete)

**Key Design**:
- NO athleteId - separate concern
- If employee wants app, they sign up separately as Athlete

### CompanyRoadmapItem

**Table**: `company_roadmap_items`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String? (nullable - legacy Company relation)
- `goFastCompanyId` - String? (nullable - using GoFastCompany instead)
- `itemType` - String (default: "Dev Work") - "Dev Work" or "Product Milestone"
- `primaryRepo` - String? - "mvp1", "eventslanding", "companystack"
- `category` - String (default: "Core Feature") - "Core Feature", "Frontend Demo", "API Integration", "Backend Scaffolding"
- `title` - String (required)
- `whatItDoes` - String? - User value proposition
- `howItHelps` - String? - How it helps overall build
- `quickModelScaffolding` - String?
- `relationalMapping` - String? - Does this bolt on to athleteId?
- `apiIntegration` - String? - API-specific integration
- `prerequisites` - String? - Setup, research, account creation, auth
- `orderNumber` - Int?
- `hoursEstimated` - Int?
- `hoursSpent` - Int?
- `targetDate` - DateTime?
- `dueDate` - DateTime?
- `status` - String (default: "Not Started") - Not Started, In Progress, Done
- `priority` - String (default: "Enhanced User Feature") - Critical Path, Enhanced User Feature, Future Release, Revenue Builder
- `completedAt` - DateTime?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `company` - Many-to-one: `Company?` (optional, cascade delete)
- `GoFastCompany` - Many-to-one: `GoFastCompany?` (optional)

### CompanyCrmContact

**Table**: `company_crm_contacts`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String (foreign key to Company)
- `name` - String (required)
- `role` - String? - "Club Director", "Partnership Lead", etc.
- `email` - String?
- `companyName` - String? - Their company (club/organization name)
- `pipeline` - String (default: "prospects") - prospects, warm, onboarding, active, churned
- `status` - String (default: "new") - new, warm, active, exploring, cold
- `nextStep` - String? - "Onboarding call", "Contract review", "Integration setup"
- `notes` - String?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `company` - Many-to-one: `Company` (cascade delete)

### CompanyFinancialSpend

**Table**: `company_financial_spends`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String (foreign key to Company)
- `goFastCompanyId` - String? (nullable - using GoFastCompany instead)
- `date` - DateTime (required) - When the spend occurred
- `amount` - Float (required) - Amount spent (negative for expenses)
- `category` - String (required) - "salaries", "marketing", "operations", "software", "office", etc.
- `description` - String? - Transaction description
- `vendor` - String? - Who we paid
- `department` - String? - Which department
- `project` - String? - Which project
- `receiptUrl` - String? - Link to receipt/documentation
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `company` - Many-to-one: `Company` (cascade delete)
- `GoFastCompany` - Many-to-one: `GoFastCompany?` (optional)

### CompanyFinancialProjection

**Table**: `company_financial_projections`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String (foreign key to Company)
- `goFastCompanyId` - String? (nullable - using GoFastCompany instead)
- `period` - String (required) - "monthly", "quarterly", "yearly"
- `periodStart` - DateTime (required)
- `periodEnd` - DateTime (required)
- `projectedRevenue` - Float? - Projected revenue for period (TOTAL)
- `projectedExpenses` - Float (required) - Projected expenses for period (TOTAL)
- `projectedNet` - Float? - Projected net (revenue - expenses) (TOTAL)
- `categoryBreakdown` - Json? - { "salaries": 50000, "marketing": 10000, "operations": 5000 }
- `currentCash` - Float? - Current cash on hand (TOTAL)
- `monthlyBurnRate` - Float? - Monthly burn (expenses) (TOTAL)
- `runwayMonths` - Float? - Months of runway (calculated: cash / monthlyBurn)
- `assumptions` - String? - Notes on assumptions
- `status` - String (default: "draft") - draft, active, archived
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `company` - Many-to-one: `Company` (cascade delete)
- `GoFastCompany` - Many-to-one: `GoFastCompany?` (optional)

### Task

**Table**: `tasks`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `founderId` - String? (polymorphic - for founder personal tasks)
- `companyId` - String? (polymorphic - for company-wide tasks)
- `goFastCompanyId` - String? (nullable - using GoFastCompany instead)
- `title` - String (required)
- `description` - String?
- `status` - String (default: "pending") - pending, in_progress, completed, cancelled
- `priority` - String (default: "medium") - low, medium, high, urgent
- `dueDate` - DateTime?
- `department` - String? - "Engineering", "Design", "Marketing" (for company tasks)
- `isTopPriority` - Boolean (default: false) - Founder can mark "most important now"
- `completedAt` - DateTime?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `founder` - Many-to-one: `Founder?` (optional, cascade delete)
- `company` - Many-to-one: `Company?` (optional, cascade delete)
- `GoFastCompany` - Many-to-one: `GoFastCompany?` (optional)

**Key Design**:
- Polymorphic link - ONE of founderId or companyId must be set

### GoFastCompany

**Table**: `gofast_company`  
**Primary Key**: `id` (String, cuid) - Single tenant, hardcoded ID in config

**Fields**:
- `id` - Primary identifier (cuid) - Hardcoded: `cmhpqe7kl0000nw1uvcfhf2hs`
- `companyName` - String (required) - "GoFast Inc"
- `address` - String? - "2604 N. George Mason Dr."
- `city` - String? - "Arlington"
- `state` - String? - "VA"
- `website` - String? - "gofastcrushgoals.com"
- `description` - String?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `staff` - One-to-many: `CompanyStaff[]`
- `contacts` - One-to-many: `Contact[]`
- `productPipelineItems` - One-to-many: `ProductPipelineItem[]`
- `financialSpends` - One-to-many: `CompanyFinancialSpend[]`
- `financialProjections` - One-to-many: `CompanyFinancialProjection[]`
- `roadmapItems` - One-to-many: `CompanyRoadmapItem[]`
- `tasks` - One-to-many: `Task[]`

**Key Design**:
- Single-tenant company operations
- All relations scoped to this single company

### CompanyStaff

**Table**: `company_staff`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `firebaseId`

**Fields**:
- `id` - Primary identifier (cuid)
- `firebaseId` - String (unique, required) - Firebase auth ID
- `firstName` - String?
- `lastName` - String?
- `email` - String (required)
- `photoURL` - String? - Profile photo URL from Firebase
- `companyId` - String? (nullable - links to GoFastCompany.id)
- `role` - String (required) - "Founder", "CFO", "Sales", "Marketing", "Community Manager"
- `startDate` - DateTime? - When staff joined/started
- `salary` - Float? - Optional salary
- `verificationCode` - String? - Unique code for employee onboarding
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `company` - Many-to-one: `GoFastCompany?` (optional, cascade delete)

### Contact

**Table**: `contacts`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String (foreign key to GoFastCompany)
- `firstName` - String?
- `lastName` - String?
- `goesBy` - String? - Preferred name
- `email` - String?
- `phone` - String?
- `title` - String?
- `pipelineId` - String? - Unique identifier for contact's pipeline journey
- `audienceType` - String? - "EliteRunner", "RunClub", "RunnerInfluencer", etc.
- `pipelineStage` - String? - "Interest", "Meeting", "Agreement", "OnPlatform"
- `athleteId` - String? - Links to Athlete.id if contact converted to athlete
- `notes` - String?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `company` - Many-to-one: `GoFastCompany` (cascade delete)

### ProductPipelineItem

**Table**: `product_pipeline_items`  
**Primary Key**: `id` (String, cuid)

**Fields**:
- `id` - Primary identifier (cuid)
- `companyId` - String (foreign key to GoFastCompany)
- `name` - String (required) - Product feature/module name (user input)
- `description` - String? - Description (user input)
- `timeItTakes` - String? - "2 weeks", "1 month" (user input)
- `status` - String (default: "pending") - pending, in_progress, completed, cancelled
- `priority` - String (default: "medium") - low, medium, high, urgent
- `startedAt` - DateTime?
- `completedAt` - DateTime?
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `company` - Many-to-one: `GoFastCompany` (cascade delete)

---

## Parent & Young Athlete Models

### Parent

**Table**: `parents`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `firebaseId`, `email`, `garmin_user_id`

**Fields**:
- `id` - Primary identifier (cuid)
- `firebaseId` - String (unique, required) - Firebase auth ID
- `firstName` - String?
- `lastName` - String?
- `email` - String (unique, required)
- `phoneNumber` - String?
- `photoURL` - String?

**Garmin OAuth 2.0 PKCE Integration** (for claiming parent's activities as race results):
- `garmin_user_id` - String? (unique)
- `garmin_access_token` - String?
- `garmin_refresh_token` - String?
- `garmin_expires_in` - Int?
- `garmin_scope` - String?
- `garmin_connected_at` - DateTime?
- `garmin_last_sync_at` - DateTime?
- `garmin_permissions` - Json?
- `garmin_is_connected` - Boolean (default: false)
- `garmin_disconnected_at` - DateTime?

**System Fields**:
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `youngAthletes` - One-to-many: `YoungAthlete[]`

### YoungAthlete

**Table**: `young_athletes`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `garmin_user_id`  
**Indexes**: `[parentId]`, `[eventCode]`

**Fields**:
- `id` - Primary identifier (cuid)
- `parentId` - String (foreign key to Parent, NOT athleteId)
- `eventCode` - String (required) - Event identifier
- `firstName` - String (required)
- `lastName` - String (required)
- `grade` - String?
- `school` - String?
- `profilePicUrl` - String?

**Garmin OAuth 2.0 PKCE Integration** (separate Garmin app for young athletes):
- `garmin_user_id` - String? (unique)
- `garmin_access_token` - String?
- `garmin_refresh_token` - String?
- `garmin_expires_in` - Int?
- `garmin_scope` - String?
- `garmin_connected_at` - DateTime?
- `garmin_last_sync_at` - DateTime?
- `garmin_permissions` - Json?
- `garmin_is_connected` - Boolean (default: false)
- `garmin_disconnected_at` - DateTime?

**System Fields**:
- `createdAt` - DateTime (default: now())

**Relations**:
- `parent` - Many-to-one: `Parent` (cascade delete)
- `goals` - One-to-many: `EventGoal[]`
- `results` - One-to-many: `EventResult[]`
- `activities` - One-to-many: `YoungAthleteActivity[]`

### EventGoal

**Table**: `event_goals`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[youngAthleteId, eventCode]` (composite)  
**Indexes**: `[eventCode]`

**Fields**:
- `id` - Primary identifier (cuid)
- `youngAthleteId` - String (foreign key to YoungAthlete)
- `eventCode` - String (required)
- `targetDistance` - String?
- `targetPace` - String?
- `motivation` - String?
- `feeling` - String?
- `createdAt` - DateTime (default: now())

**Relations**:
- `youngAthlete` - Many-to-one: `YoungAthlete` (cascade delete)

### EventResult

**Table**: `event_results`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `[youngAthleteId, eventCode]` (composite)  
**Indexes**: `[eventCode]`, `[activityId]`, `[parentActivityId]`

**Fields**:
- `id` - Primary identifier (cuid)
- `eventCode` - String (required)
- `youngAthleteId` - String (foreign key to YoungAthlete)
- `parentId` - String? - Parent who claimed this (optional - for legacy parent Garmin activities)
- `activityId` - String? (unique) - Links to YoungAthleteActivity.id (primary - young athlete's own activity)
- `parentActivityId` - String? - Links to AthleteActivity.id (legacy - parent's Garmin activity claimed as result)
- `createdAt` - DateTime (default: now())

**Relations**:
- `youngAthlete` - Many-to-one: `YoungAthlete` (cascade delete)
- `activity` - Many-to-one: `YoungAthleteActivity?` (optional, cascade delete)
- `parentActivity` - Many-to-one: `AthleteActivity?` (optional, cascade delete)

### YoungAthleteActivity

**Table**: `young_athlete_activities`  
**Primary Key**: `id` (String, cuid)  
**Unique Constraints**: `sourceActivityId`  
**Indexes**: `[youngAthleteId]`, `[garminUserId]`

**Fields**:
- `id` - Primary identifier (cuid)
- `youngAthleteId` - String (foreign key to YoungAthlete)
- `sourceActivityId` - String (unique, required) - Garmin's unique activity ID
- `source` - String (default: "garmin")

**Core Activity Data** (same structure as AthleteActivity):
- `activityType` - String?
- `activityName` - String?
- `startTime` - DateTime?
- `duration` - Int? - Duration in seconds
- `distance` - Float? - Distance in meters
- `averageSpeed` - Float? - Average speed in m/s
- `calories` - Int?

**Performance Metrics**:
- `averageHeartRate` - Int?
- `maxHeartRate` - Int?
- `elevationGain` - Float?
- `steps` - Int?

**Location Data**:
- `startLatitude` - Float?
- `startLongitude` - Float?
- `endLatitude` - Float?
- `endLongitude` - Float?
- `summaryPolyline` - String?

**Device Information**:
- `deviceName` - String?
- `garminUserId` - String?

**Hybrid Data Storage**:
- `summaryData` - Json?
- `detailData` - Json?
- `hydratedAt` - DateTime?

**Timestamps**:
- `syncedAt` - DateTime (default: now())
- `lastUpdatedAt` - DateTime (default: now())
- `createdAt` - DateTime (default: now())
- `updatedAt` - DateTime (auto-updated)

**Relations**:
- `youngAthlete` - Many-to-one: `YoungAthlete` (cascade delete)
- `eventResults` - One-to-many: `EventResult[]`

---

## F3 Workout Models

### Workout

**Table**: `workouts`  
**Primary Key**: `workoutId` (String)

**Fields**:
- `workoutId` - Primary identifier (String)
- `date` - DateTime (required)
- `ao` - String? - Area of Operations
- `qId` - String (required) - Q (leader) ID
- `cot` - String? - Circle of Trust
- `createdAt` - DateTime (default: now())

**Relations**:
- `warmup` - One-to-one: `WarmUp?`
- `thang` - One-to-one: `Thang?`
- `mary` - One-to-one: `Mary?`

### WarmUp

**Table**: `warm_ups`  
**Primary Key**: `warmupId` (String)  
**Unique Constraints**: `workoutId`

**Fields**:
- `warmupId` - Primary identifier (String)
- `workoutId` - String (unique, foreign key to Workout)

**Relations**:
- `workout` - One-to-one: `Workout` (cascade delete)
- `moves` - One-to-many: `WarmUpMove[]`

### WarmUpMove

**Table**: `warm_up_moves`  
**Primary Key**: `warmUpMoveId` (String)

**Fields**:
- `warmUpMoveId` - Primary identifier (String)
- `warmupId` - String (foreign key to WarmUp)
- `type` - WarmUpMoveType (enum, required)
- `count` - Int?

**Enum WarmUpMoveType**:
- SSH
- ImperialWalkers
- ArmCircles
- HighKnees
- Windmills
- Skaters
- Mosey

**Relations**:
- `warmup` - Many-to-one: `WarmUp` (cascade delete)

### Thang

**Table**: `thangs`  
**Primary Key**: `thangId` (String)  
**Unique Constraints**: `workoutId`

**Fields**:
- `thangId` - Primary identifier (String)
- `workoutId` - String (unique, foreign key to Workout)

**Relations**:
- `workout` - One-to-one: `Workout` (cascade delete)
- `blocks` - One-to-many: `ThangBlock[]`

### ThangBlock

**Table**: `thang_blocks`  
**Primary Key**: `thangBlockId` (String)

**Fields**:
- `thangBlockId` - Primary identifier (String)
- `thangId` - String (foreign key to Thang)
- `title` - String?
- `description` - String?
- `order` - Int (required)

**Relations**:
- `thang` - Many-to-one: `Thang` (cascade delete)
- `moves` - One-to-many: `ThangMove[]`

### ThangMove

**Table**: `thang_moves`  
**Primary Key**: `thangMoveId` (String)

**Fields**:
- `thangMoveId` - Primary identifier (String)
- `thangBlockId` - String (foreign key to ThangBlock)
- `type` - ThangMoveType (enum, required)
- `distanceYards` - Int?
- `reps` - Int?
- `durationSec` - Int?
- `notes` - String?
- `order` - Int (required)

**Enum ThangMoveType**:
- Merkins
- Squats
- Burpees
- BearCrawl
- BroadJump
- LungeWalk
- ShoulderTap
- JumpSquat
- MountainClimber
- RickyBobby
- Sprint
- Mosey
- Karaoke

**Relations**:
- `thangBlock` - Many-to-one: `ThangBlock` (cascade delete)

### Mary

**Table**: `marys`  
**Primary Key**: `maryId` (String)  
**Unique Constraints**: `workoutId`

**Fields**:
- `maryId` - Primary identifier (String)
- `workoutId` - String (unique, foreign key to Workout)

**Relations**:
- `workout` - One-to-one: `Workout` (cascade delete)
- `moves` - One-to-many: `MaryMove[]`

### MaryMove

**Table**: `mary_moves`  
**Primary Key**: `maryMoveId` (String)

**Fields**:
- `maryMoveId` - Primary identifier (String)
- `maryId` - String (foreign key to Mary)
- `type` - MaryType (enum, required)
- `count` - Int?

**Enum MaryType**:
- FlutterKicks
- LBCs
- AmericanHammers
- FreddieMercurys
- BigBoySitups
- HelloDollies
- Plank

**Relations**:
- `mary` - Many-to-one: `Mary` (cascade delete)

---

## Key Relationships

### Athlete ↔ RunCrew (Many-to-Many)

**Pattern**: Junction table (`RunCrewMembership`)

**Key Points**:
- Athlete can be in **multiple crews**
- RunCrew can have **multiple athletes**
- Junction table is **source of truth**
- NO direct `runCrewId` on Athlete model
- Admin/manager roles via `RunCrewManager` table

**Query Pattern**:
```prisma
const athlete = await prisma.athlete.findUnique({
  where: { id: athleteId },
  include: {
    runCrewMemberships: {
      include: { runCrew: true }
    }
  }
});
```

### Athlete ↔ Activities (One-to-Many)

**Pattern**: Direct foreign key

**Key Points**:
- One athlete has many activities
- Activities cascade delete when athlete is deleted
- `sourceActivityId` is unique (Garmin's activity ID)

### Athlete ↔ Training Plans (One-to-Many)

**Pattern**: Direct foreign key

**Key Points**:
- One athlete has many training plans
- Training plans link to Race
- Training plans have phases and planned days
- Executions track actual completion

### Athlete ↔ Founder (One-to-One Optional)

**Pattern**: Optional extension

**Key Points**:
- Founder IS an athlete (links to Athlete)
- For GoFast Company employees/founders
- Separate concern from athlete identity
- Optional - not all athletes are founders

---

## Constraints & Indexes

### Unique Constraints

**Single Field**:
- `Athlete.firebaseId` - Unique
- `Athlete.email` - Unique
- `Athlete.garmin_user_id` - Unique
- `Athlete.strava_id` - Unique
- `Athlete.gofastHandle` - Unique
- `RunCrew.joinCode` - Unique
- `JoinCode.code` - Unique
- `HandleRegistry.handle` - Unique
- `AthleteActivity.sourceActivityId` - Unique
- `TrainingDayExecuted.activityId` - Unique (optional)

**Composite Unique**:
- `RunCrewMembership[runCrewId, athleteId]` - One membership per athlete per crew
- `RunCrewManager[runCrewId, athleteId]` - One role per athlete per crew
- `RunCrewRunRSVP[runId, athleteId]` - One RSVP per athlete per run
- `RunCrewEventRSVP[eventId, athleteId]` - One RSVP per athlete per event
- `EventRegistration[eventId, email]` - One registration per email per event
- `EventGoal[youngAthleteId, eventCode]` - One goal per young athlete per event
- `EventResult[youngAthleteId, eventCode]` - One result per young athlete per event
- `TrainingDayPlanned[trainingPlanId, weekIndex, dayIndex]` - One planned day per position
- `TrainingDayExecuted[executionId, date]` - One execution per day per plan execution
- `CompanyFounder[companyId, founderId]` - One founder role per company
- `CompanyEmployee[companyId, email]` - One email per company

### Indexes

**Single Field Indexes**:
- `Event[athleteId]` - For athlete's events lookup
- `EventVolunteer[eventId]` - For event volunteers lookup
- `EventRegistration[eventId]` - For event registrations lookup
- `YoungAthlete[parentId]` - For parent's young athletes lookup
- `YoungAthlete[eventCode]` - For event participants lookup
- `EventGoal[eventCode]` - For event goals lookup
- `EventResult[eventCode]` - For event results lookup
- `EventResult[activityId]` - For activity results lookup
- `EventResult[parentActivityId]` - For parent activity results lookup
- `YoungAthleteActivity[youngAthleteId]` - For young athlete's activities lookup
- `YoungAthleteActivity[garminUserId]` - For Garmin user activities lookup

**Composite Indexes**:
- `Event[athleteId, title, date]` - For upsert lookup
- `Message[groupId, createdAt]` - For efficient queries by group and time

### Cascade Deletes

**Cascade Delete Rules**:
- All relations to `Athlete` cascade delete (except `Race.createdByAthleteId` which sets null)
- All relations to `RunCrew` cascade delete
- All relations to `TrainingPlan` cascade delete
- All relations to `Event` cascade delete
- All relations to `Parent` cascade delete
- All relations to `YoungAthlete` cascade delete
- All relations to `Founder` cascade delete
- All relations to `Company` cascade delete
- All relations to `GoFastCompany` cascade delete

**Set Null Rules**:
- `Race.createdByAthleteId` - Sets null when athlete is deleted (race is independent)
- `TrainingPhase.trainingPhaseId` - Sets null when phase is deleted

---

## Table Mappings

All Prisma models use `@@map()` to specify PostgreSQL table names:

- `Athlete` → `athletes`
- `AthleteActivity` → `athlete_activities`
- `RunCrew` → `run_crews`
- `RunCrewMembership` → `run_crew_memberships`
- `RunCrewManager` → `run_crew_managers`
- `RunCrewMessage` → `run_crew_messages`
- `RunCrewAnnouncement` → `run_crew_announcements`
- `RunCrewRun` → `run_crew_runs`
- `RunCrewRunRSVP` → `run_crew_run_rsvps`
- `RunCrewEvent` → `run_crew_events`
- `RunCrewEventRSVP` → `run_crew_event_rsvps`
- `JoinCode` → `join_codes`
- `HandleRegistry` → `handle_registry`
- `Event` → `events`
- `EventVolunteer` → `event_volunteers`
- `EventRegistration` → `event_registrations`
- `Race` → `races`
- `TrainingPlan` → `training_plans`
- `TrainingPhase` → `training_phases`
- `TrainingDayPlanned` → `training_days_planned`
- `TrainingPlanExecution` → `training_plan_executions`
- `TrainingDayExecuted` → `training_days_executed`
- `Founder` → `founders`
- `FounderTask` → `founder_tasks`
- `CrmContact` → `crm_contacts`
- `RoadmapItem` → `roadmap_items`
- `Company` → `companies`
- `CompanyFounder` → `company_founders`
- `CompanyEmployee` → `company_employees`
- `CompanyRoadmapItem` → `company_roadmap_items`
- `CompanyCrmContact` → `company_crm_contacts`
- `CompanyFinancialSpend` → `company_financial_spends`
- `CompanyFinancialProjection` → `company_financial_projections`
- `Task` → `tasks`
- `Message` → `messages`
- `GoFastCompany` → `gofast_company`
- `CompanyStaff` → `company_staff`
- `Contact` → `contacts`
- `ProductPipelineItem` → `product_pipeline_items`
- `Parent` → `parents`
- `YoungAthlete` → `young_athletes`
- `EventGoal` → `event_goals`
- `EventResult` → `event_results`
- `YoungAthleteActivity` → `young_athlete_activities`
- `Workout` → `workouts`
- `WarmUp` → `warm_ups`
- `WarmUpMove` → `warm_up_moves`
- `Thang` → `thangs`
- `ThangBlock` → `thang_blocks`
- `ThangMove` → `thang_moves`
- `Mary` → `marys`
- `MaryMove` → `mary_moves`

---

## Notes for Database Rebuild

1. **Primary Keys**: All use `String @id @default(cuid())` except F3 Workout models which use custom String IDs
2. **Timestamps**: Standard pattern is `createdAt` (default: now()) and `updatedAt` (auto-updated)
3. **Soft Deletes**: `RunCrew.isArchived` and `RunCrew.archivedAt` for soft delete pattern
4. **JSON Fields**: Used for flexible data storage (Garmin data, training plan data, etc.)
5. **Enums**: Used for `WarmUpMoveType`, `ThangMoveType`, and `MaryType`
6. **Nullable Fields**: Most optional fields are nullable (String?, Int?, Float?, DateTime?)
7. **Required Fields**: Core identity fields (id, firebaseId, email) are required
8. **Foreign Keys**: All use `onDelete: Cascade` except `Race.createdByAthleteId` (SetNull) and `TrainingPhase` (SetNull)

---

**End of Schema Documentation**

