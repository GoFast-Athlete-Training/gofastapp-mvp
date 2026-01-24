# Unified Race Model Vision

## Current State

**Existing Model**: `race_registry` (gofastapp-mvp)
```prisma
model race_registry {
  id                      String                    @id @default(cuid())
  name                    String
  raceType                String                    // e.g., "5k", "10k", "marathon"
  miles                   Float
  date                    DateTime                  // Race date
  city                    String?
  state                   String?
  country                 String?
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime                  @updatedAt
  
  // Relations
  training_plans          training_plans[]
  run_crew_specific_races run_crew_specific_races[]
  run_crews_training_for  run_crews[]               @relation("TrainingForRace")
}
```

**What's Missing**:
- Start time / end time
- Charity information
- Registration details
- Course information
- Weather/climate data
- Elevation profile
- Surface type
- And more...

---

## Vision: Unified Race Model

**Goal**: Create a comprehensive race model that serves as the single source of truth for all race-related functionality in gofastapp-mvp.

**Use Cases**:
1. **Training Plans** - Athletes training for races
2. **RunCrew Training** - RunCrews training for specific races
3. **Race Discovery** - Athletes finding races to sign up for
4. **Race Tracking** - Athletes tracking their race goals/results
5. **RunClub Affiliation** - RunClubs can sponsor/affiliate with races
6. **Charity Races** - Support charity causes
7. **Race Calendar** - Upcoming races by location/date

---

## Proposed Unified Race Model

```prisma
model race_registry {
  id                      String                    @id @default(cuid())
  
  // Basic Identity
  name                    String                    // e.g., "Boston Marathon"
  slug                    String?                   @unique // URL-friendly: "boston-marathon-2025"
  description             String?                   // Full race description
  raceType                String                    // e.g., "5k", "10k", "10m", "half", "marathon", "ultra", "other"
  distanceMiles           Float                     // Exact distance in miles
  distanceKm               Float?                   // Exact distance in kilometers
  
  // Date & Time
  raceDate                DateTime                  // Race date (date only, time = 00:00:00)
  startTime               DateTime?                 // Actual start time (e.g., "2025-04-21T09:00:00Z")
  endTime                 DateTime?                 // Expected end time (for cutoff)
  timezone                String?                   // e.g., "America/New_York"
  registrationOpenDate    DateTime?                 // When registration opens
  registrationCloseDate   DateTime?                 // When registration closes
  
  // Location
  city                    String?
  state                   String?
  country                 String?                   @default("USA")
  address                 String?                   // Full address
  startLocation           String?                   // Start line location name
  finishLocation          String?                   // Finish line location name
  startLat                Float?
  startLng                Float?
  finishLat               Float?
  finishLng               Float?
  
  // Registration & Links
  registrationUrl         String?                   // Link to registration
  officialWebsiteUrl      String?                   // Race official website
  resultsUrl              String?                   // Link to results (post-race)
  courseMapUrl            String?                   // Course map link
  stravaSegmentUrl         String?                   // Strava segment link
  
  // Course Information
  elevationGain           Float?                    // Elevation gain in feet
  elevationGainMeters     Float?                    // Elevation gain in meters
  surfaceType             String?                   // "road", "trail", "track", "mixed"
  courseType              String?                   // "loop", "point-to-point", "out-and-back"
  courseProfile           Json?                     // Detailed course data (elevation profile, etc.)
  
  // Weather & Climate
  typicalWeather          String?                   // "cool", "hot", "variable"
  averageTemperature      Int?                      // Average temp in Fahrenheit
  averageHumidity         Int?                      // Average humidity percentage
  
  // Charity & Cause
  charitySupported        Boolean                   @default(false)
  charityName             String?                   // Name of charity/cause
  charityUrl              String?                   // Link to charity
  charityDescription      String?                   // Description of cause
  
  // Organization
  organizerName            String?                   // Race organizer name
  organizerEmail          String?                   // Contact email
  organizerWebsite        String?                   // Organizer website
  
  // Pricing (optional)
  registrationFee         Float?                    // Registration fee in USD
  earlyBirdFee           Float?                    // Early bird pricing
  earlyBirdDeadline      DateTime?                 // Early bird deadline
  
  // Capacity & Limits
  maxParticipants         Int?                      // Maximum participants
  currentParticipants     Int?                      // Current registrations (if tracked)
  ageMinimum              Int?                      // Minimum age requirement
  ageMaximum              Int?                      // Maximum age requirement
  
  // Status & Flags
  isActive                Boolean                   @default(true)
  isVirtual               Boolean                   @default(false)
  isCancelled             Boolean                   @default(false)
  cancellationReason      String?                   // Why cancelled
  
  // Metadata
  tags                    String[]                  @default([]) // e.g., ["boston", "marathon", "qualifying"]
  notes                   String?                   // Internal notes
  
  // Timestamps
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime                  @updatedAt
  
  // Relations
  training_plans          training_plans[]
  run_crew_specific_races run_crew_specific_races[]
  run_crews_training_for  run_crews[]               @relation("TrainingForRace")
  // Future: athlete_race_signups, race_results, etc.
  
  @@index([raceDate])
  @@index([city, state])
  @@index([raceType])
  @@index([slug])
  @@index([isActive])
  @@index([charitySupported])
  @@index([tags])
  @@map("race_registry")
}
```

---

## Migration Strategy

### Phase 1: Add New Fields (Backward Compatible)

```sql
-- Add new fields to existing race_registry table
ALTER TABLE "race_registry"
  ADD COLUMN IF NOT EXISTS "slug" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "distanceKm" FLOAT,
  ADD COLUMN IF NOT EXISTS "startTime" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "endTime" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationOpenDate" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "registrationCloseDate" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "startLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "finishLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "startLat" FLOAT,
  ADD COLUMN IF NOT EXISTS "startLng" FLOAT,
  ADD COLUMN IF NOT EXISTS "finishLat" FLOAT,
  ADD COLUMN IF NOT EXISTS "finishLng" FLOAT,
  ADD COLUMN IF NOT EXISTS "registrationUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "officialWebsiteUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "resultsUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "courseMapUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "stravaSegmentUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "elevationGain" FLOAT,
  ADD COLUMN IF NOT EXISTS "elevationGainMeters" FLOAT,
  ADD COLUMN IF NOT EXISTS "surfaceType" TEXT,
  ADD COLUMN IF NOT EXISTS "courseType" TEXT,
  ADD COLUMN IF NOT EXISTS "courseProfile" JSONB,
  ADD COLUMN IF NOT EXISTS "typicalWeather" TEXT,
  ADD COLUMN IF NOT EXISTS "averageTemperature" INT,
  ADD COLUMN IF NOT EXISTS "averageHumidity" INT,
  ADD COLUMN IF NOT EXISTS "charitySupported" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "charityName" TEXT,
  ADD COLUMN IF NOT EXISTS "charityUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "charityDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "organizerName" TEXT,
  ADD COLUMN IF NOT EXISTS "organizerEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "organizerWebsite" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationFee" FLOAT,
  ADD COLUMN IF NOT EXISTS "earlyBirdFee" FLOAT,
  ADD COLUMN IF NOT EXISTS "earlyBirdDeadline" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "maxParticipants" INT,
  ADD COLUMN IF NOT EXISTS "currentParticipants" INT,
  ADD COLUMN IF NOT EXISTS "ageMinimum" INT,
  ADD COLUMN IF NOT EXISTS "ageMaximum" INT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isVirtual" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isCancelled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Rename existing fields for clarity
ALTER TABLE "race_registry"
  RENAME COLUMN "date" TO "raceDate",
  RENAME COLUMN "miles" TO "distanceMiles";

-- Generate slugs from name + date for existing races
UPDATE "race_registry"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name || '-' || TO_CHAR("raceDate", 'YYYY'), '[^a-z0-9]+', '-', 'g'),
    '^-+|-+$', '', 'g'
  )
)
WHERE "slug" IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS "race_registry_raceDate_idx" ON "race_registry"("raceDate");
CREATE INDEX IF NOT EXISTS "race_registry_city_state_idx" ON "race_registry"("city", "state");
CREATE INDEX IF NOT EXISTS "race_registry_raceType_idx" ON "race_registry"("raceType");
CREATE INDEX IF NOT EXISTS "race_registry_slug_idx" ON "race_registry"("slug");
CREATE INDEX IF NOT EXISTS "race_registry_isActive_idx" ON "race_registry"("isActive");
CREATE INDEX IF NOT EXISTS "race_registry_charitySupported_idx" ON "race_registry"("charitySupported");
CREATE INDEX IF NOT EXISTS "race_registry_tags_idx" ON "race_registry" USING GIN("tags");
```

### Phase 2: Update Code

- Update API endpoints to handle new fields
- Update forms to collect new data
- Update display components to show new information

### Phase 3: Data Population

- Populate existing races with new fields (manual or via import)
- Add charity information where applicable
- Add start/end times where available

---

## Use Cases Enabled

### 1. Race Discovery
- Filter by location, date, distance, charity
- Show upcoming races with registration deadlines
- Display race details (course, elevation, weather)

### 2. Training Plans
- Link training plans to specific races
- Show race date/countdown
- Display race details in training plan view

### 3. RunCrew Training
- RunCrews can train for specific races
- Show race information in RunCrew dashboard
- Track progress toward race goals

### 4. Charity Races
- Filter races by charity/cause
- Show charity information prominently
- Link to charity donation pages

### 5. Race Calendar
- Calendar view of upcoming races
- Filter by location, distance, date range
- Show registration deadlines

### 6. RunClub Affiliation
- RunClubs can affiliate with races (via `runClubSlug` in `city_runs`)
- Show "RunClub X is training for Race Y"
- Display RunClub logos on race pages

---

## Open Questions

- [ ] Do we need separate models for virtual vs. in-person races?
- [ ] Should we track race results in this model or separate?
- [ ] Do we need athlete race signups/registrations model?
- [ ] Should we integrate with external race APIs (RunSignup, etc.)?
- [ ] Do we need race series/championships support?

---

## Next Steps

1. [ ] Review and refine field list
2. [ ] Create migration script
3. [ ] Update schema.prisma
4. [ ] Update API endpoints
5. [ ] Update UI components
6. [ ] Populate existing data

