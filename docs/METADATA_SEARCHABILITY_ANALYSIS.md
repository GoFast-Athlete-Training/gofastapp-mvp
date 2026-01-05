# Metadata & Searchability Analysis

**Date:** January 2025  
**Purpose:** Investigate current metadata fields and identify gaps for searchability  
**Scope:** Athlete, RunCrew, RunCrewRun, RunCrewEvent metadata

---

## Executive Summary

Current metadata is limited and lacks several key fields needed for effective search, discovery, and filtering. This document outlines what exists, what's missing, and recommendations for improvement.

---

## 1. Current Metadata Inventory

### 1.1 Athlete Model (`Athlete`)

**Location Metadata:**
- ✅ `city` - String?
- ✅ `state` - String?
- ❌ `country` - Missing
- ❌ `zipCode` / `postalCode` - Missing
- ❌ `latitude` / `longitude` - Missing
- ❌ `timezone` - Missing

**Performance/Pace Metadata:**
- ✅ `fiveKPace` - String? (e.g., "8:00")
- ✅ `weeklyMileage` - Int?
- ❌ `paceRangeMin` / `paceRangeMax` - Missing (structured pace data)
- ❌ `averagePace` - Missing (computed from activities)
- ❌ `preferredPace` - Missing
- ❌ `fastest5K` - Missing
- ❌ `fastest10K` - Missing
- ❌ `fastestHalfMarathon` - Missing
- ❌ `fastestMarathon` - Missing

**Profile Metadata:**
- ✅ `firstName` - String?
- ✅ `lastName` - String?
- ✅ `gofastHandle` - String? @unique
- ✅ `photoURL` - String?
- ✅ `phoneNumber` - String?
- ✅ `birthday` - DateTime?
- ✅ `gender` - String?
- ✅ `primarySport` - String?
- ✅ `bio` - String?
- ✅ `instagram` - String?
- ❌ `preferredDistance` - Missing (5K, 10K, half, marathon, etc.)
- ❌ `experienceLevel` - Missing (beginner, intermediate, advanced, elite)
- ❌ `runningGoals` - Missing (structured tags/interests)
- ❌ `preferredRunningTimes` - Missing (morning, afternoon, evening)
- ❌ `preferredRunningDays` - Missing (weekdays, weekends, specific days)
- ❌ `tags` / `interests` - Missing (Array of strings)
- ❌ `lastActiveDate` - Missing (for activity-based search)

**Activity Metadata (from `athlete_activities`):**
- ✅ `startLatitude` / `startLongitude` - Float?
- ✅ `averageSpeed` - Float?
- ✅ `distance` - Float?
- ✅ `averageHeartRate` - Int?
- ❌ These are activity-level, not athlete-level aggregates

---

### 1.2 RunCrew Model (`RunCrew`)

**Location Metadata:**
- ❌ `city` - Missing
- ❌ `state` - Missing
- ❌ `country` - Missing
- ❌ `zipCode` / `postalCode` - Missing
- ❌ `latitude` / `longitude` - Missing (primary location)
- ❌ `timezone` - Missing

**Profile Metadata:**
- ✅ `name` - String
- ✅ `description` - String?
- ✅ `logo` - String?
- ✅ `icon` - String?
- ✅ `joinCode` - String @unique
- ❌ `paceRange` - Missing (typical pace range for crew)
- ❌ `averagePace` - Missing
- ❌ `memberCount` - Missing (would need aggregation)
- ❌ `primaryLocation` - Missing (city/state for search)
- ❌ `tags` / `categories` - Missing (e.g., "trail", "road", "social", "competitive")
- ❌ `typicalRunDistance` - Missing
- ❌ `typicalRunDays` - Missing (when crew usually runs)
- ❌ `typicalRunTimes` - Missing (morning, evening, etc.)
- ❌ `foundedDate` - Missing (for "established" metadata)
- ❌ `privacy` / `visibility` - Missing (public, private, invite-only)

**Activity Metadata:**
- ❌ `lastRunDate` - Missing (most recent run)
- ❌ `averageMembersPerRun` - Missing (engagement metric)
- ❌ `totalRunsCount` - Missing (activity level)

---

### 1.3 RunCrewRun Model (`RunCrewRun`)

**Location Metadata:**
- ✅ `meetUpPoint` - String
- ✅ `meetUpAddress` - String?
- ✅ `meetUpPlaceId` - String?
- ✅ `meetUpLat` - Float?
- ✅ `meetUpLng` - Float?
- ✅ `timezone` - String?

**Performance/Pace Metadata:**
- ✅ `pace` - String? (e.g., "8:00-9:00 min/mile")
- ✅ `totalMiles` - Float?
- ❌ `paceMin` / `paceMax` - Missing (structured pace range)
- ❌ `elevationGain` - Missing
- ❌ `routeDifficulty` - Missing (easy, moderate, hard)

**Schedule Metadata:**
- ✅ `date` - DateTime
- ✅ `startTime` - String
- ✅ `runType` - String @default("single") (single, recurring)
- ✅ `recurrenceRule` - String?
- ✅ `recurrenceEndsOn` - DateTime?
- ❌ `duration` - Missing (estimated run duration)
- ❌ `estimatedFinishTime` - Missing

**Additional Metadata:**
- ✅ `title` - String
- ✅ `description` - String?
- ✅ `stravaMapUrl` - String?
- ❌ `tags` - Missing (e.g., "trail", "social", "tempo", "long run")
- ❌ `weather` - Missing (if available)
- ❌ `rsvpCount` - Missing (would need aggregation)

---

### 1.4 RunCrewEvent Model (`RunCrewEvent`)

**Location Metadata:**
- ✅ `location` - String
- ✅ `address` - String?
- ❌ `city` - Missing
- ❌ `state` - Missing
- ❌ `country` - Missing
- ❌ `latitude` / `longitude` - Missing
- ❌ `timezone` - Missing

**Schedule Metadata:**
- ✅ `date` - DateTime
- ✅ `time` - String
- ❌ `timezone` - Missing
- ❌ `duration` - Missing
- ❌ `endDate` / `endTime` - Missing (for multi-day events)

**Additional Metadata:**
- ✅ `title` - String
- ✅ `description` - String?
- ✅ `eventType` - String? (e.g., "happy-hour", "social", "meetup")
- ❌ `tags` - Missing
- ❌ `rsvpCount` - Missing (would need aggregation)
- ❌ `capacity` - Missing (max attendees)
- ❌ `cost` - Missing (free, paid, price)

---

## 2. Search Use Cases & Missing Metadata

### 2.1 Athlete Search/Discovery

**Use Case:** "Find runners near me with similar pace"

**Currently Possible:**
- ✅ Filter by city/state
- ✅ Filter by pace (if `fiveKPace` is set)

**Gaps:**
- ❌ Cannot filter by country (only US states)
- ❌ Cannot filter by proximity (need lat/lng)
- ❌ Cannot filter by pace range (only exact match)
- ❌ Cannot filter by preferred distance
- ❌ Cannot filter by experience level
- ❌ Cannot filter by running goals/interests
- ❌ Cannot filter by preferred running times

**Missing Fields:**
- `country` (String?)
- `latitude` / `longitude` (Float?)
- `paceRangeMin` / `paceRangeMax` (Int? - seconds per mile)
- `preferredDistance` (String? - enum or array)
- `experienceLevel` (String? - enum)
- `runningGoals` (String[]? - array of tags)
- `preferredRunningTimes` (String[]? - array)
- `tags` (String[]?)

---

### 2.2 RunCrew Search/Discovery

**Use Case:** "Find running groups in my city with pace 8:00-9:00 min/mile"

**Currently Possible:**
- ❌ Cannot filter by location (no city/state on RunCrew)
- ❌ Cannot filter by pace
- ❌ Cannot filter by tags/categories
- ❌ Cannot sort by member count
- ❌ Cannot sort by activity level

**Missing Fields:**
- `city` (String?)
- `state` (String?)
- `country` (String?)
- `latitude` / `longitude` (Float?)
- `paceRangeMin` / `paceRangeMax` (Int?)
- `tags` / `categories` (String[]?)
- `primaryLocation` (String? - city, state)
- `typicalRunDistance` (String?)
- `typicalRunDays` (String[]?)
- `typicalRunTimes` (String[]?)
- `memberCount` (Int? - denormalized for performance)
- `lastRunDate` (DateTime?)

---

### 2.3 Run Search/Filtering

**Use Case:** "Find runs this weekend near me, 5-10 miles, pace 8:00-9:00"

**Currently Possible:**
- ✅ Filter by date
- ✅ Filter by location (lat/lng exists)
- ✅ Filter by distance (`totalMiles`)
- ✅ Filter by pace (text search on `pace` field)

**Gaps:**
- ⚠️ Pace filtering is text-based (not structured)
- ❌ Cannot filter by route difficulty
- ❌ Cannot filter by tags (trail, social, etc.)
- ❌ Cannot filter by timezone

**Missing Fields:**
- `paceMin` / `paceMax` (Int? - structured pace range)
- `tags` (String[]?)
- `routeDifficulty` (String? - enum)
- `duration` (Int? - estimated minutes)
- `rsvpCount` (Int? - denormalized)

---

### 2.4 Event Search/Filtering

**Use Case:** "Find social events in my area this month"

**Currently Possible:**
- ✅ Filter by date
- ✅ Filter by `eventType` (if set)
- ⚠️ Location is free-text only

**Gaps:**
- ❌ Cannot filter by location (city/state/country)
- ❌ Cannot filter by proximity (need lat/lng)
- ❌ Cannot filter by tags
- ❌ Cannot filter by timezone

**Missing Fields:**
- `city` / `state` / `country` (String?)
- `latitude` / `longitude` (Float?)
- `timezone` (String?)
- `tags` (String[]?)
- `rsvpCount` (Int? - denormalized)
- `capacity` (Int?)
- `cost` (Float? or String?)

---

## 3. Priority Recommendations

### 3.1 High Priority (Critical for MVP Search)

**For Athlete:**
1. ✅ Add `country` (String?)
2. ✅ Add `latitude` / `longitude` (Float?)
3. ✅ Add `preferredDistance` (String? - enum: "5K", "10K", "Half Marathon", "Marathon", etc.)
4. ✅ Add `paceRangeMin` / `paceRangeMax` (Int? - seconds per mile for structured filtering)
5. ✅ Add `timezone` (String? - IANA timezone like "America/New_York")

**For RunCrew:**
1. ✅ Add `city` (String?)
2. ✅ Add `state` (String?)
3. ✅ Add `country` (String?)
4. ✅ Add `latitude` / `longitude` (Float? - primary location)
5. ✅ Add `paceRangeMin` / `paceRangeMax` (Int?)
6. ✅ Add `tags` (String[]? - array of tags like ["trail", "social", "competitive"])

**For RunCrewRun:**
1. ✅ Add `paceMin` / `paceMax` (Int? - structured pace range)
2. ✅ Add `tags` (String[]?)

**For RunCrewEvent:**
1. ✅ Add `city` / `state` / `country` (String?)
2. ✅ Add `latitude` / `longitude` (Float?)
3. ✅ Add `timezone` (String?)
4. ✅ Add `tags` (String[]?)

---

### 3.2 Medium Priority (Nice to Have)

**For Athlete:**
- `experienceLevel` (enum: "beginner", "intermediate", "advanced", "elite")
- `runningGoals` (String[]? - array of tags)
- `preferredRunningTimes` (String[]? - ["morning", "evening"])
- `preferredRunningDays` (String[]? - ["weekdays", "weekends"])
- `tags` / `interests` (String[]?)
- `lastActiveDate` (DateTime? - computed from activities)

**For RunCrew:**
- `typicalRunDistance` (String?)
- `typicalRunDays` (String[]?)
- `typicalRunTimes` (String[]?)
- `memberCount` (Int? - denormalized)
- `lastRunDate` (DateTime?)
- `privacy` (enum: "public", "private", "invite-only")

**For RunCrewRun:**
- `routeDifficulty` (enum: "easy", "moderate", "hard")
- `elevationGain` (Float?)
- `duration` (Int? - estimated minutes)
- `rsvpCount` (Int? - denormalized)

**For RunCrewEvent:**
- `capacity` (Int?)
- `cost` (Float? or String?)
- `duration` (Int? - estimated minutes)
- `rsvpCount` (Int? - denormalized)

---

### 3.3 Low Priority (Future Enhancements)

**For Athlete:**
- `fastest5K` / `fastest10K` / `fastestHalfMarathon` / `fastestMarathon` (computed from activities)
- `averagePace` (computed from activities)
- `zipCode` / `postalCode` (String?)

**For RunCrew:**
- `averageMembersPerRun` (computed)
- `totalRunsCount` (computed)
- `foundedDate` (DateTime?)

---

## 4. Implementation Notes

### 4.1 Structured vs. Text Pace

**Current:** `pace` is String? (e.g., "8:00", "8:00-9:00 min/mile")

**Recommendation:** Add structured fields for filtering:
- `paceMin` / `paceMax` (Int? - seconds per mile)
- Keep `pace` (String?) for display/backward compatibility

**Conversion:**
- "8:00" → `paceMin: 480, paceMax: 480`
- "8:00-9:00" → `paceMin: 480, paceMax: 540`

### 4.2 Location Data

**Recommendation:** Store structured location data:
- `city`, `state`, `country` (String?) - for text search/filtering
- `latitude`, `longitude` (Float?) - for proximity search

**Geocoding:** Use a geocoding service (Google Maps, Mapbox) to populate lat/lng from address.

### 4.3 Tags Arrays

**Recommendation:** Use PostgreSQL array type (String[]) for tags.

**Example:**
```prisma
tags String[] // ["trail", "social", "competitive"]
```

**Indexing:** Consider GIN index for array search:
```sql
CREATE INDEX idx_athlete_tags ON "Athlete" USING GIN (tags);
```

### 4.4 Denormalized Counts

**Recommendation:** For frequently accessed counts (memberCount, rsvpCount), consider:
1. Denormalize (store computed value, update on changes)
2. Or use database views/materialized views
3. Or compute on-demand with proper caching

**Trade-off:** Denormalization improves query performance but requires maintenance.

---

## 5. Database Migration Strategy

### 5.1 Phase 1: Add Missing Location Fields

```prisma
// Athlete
country     String?
latitude    Float?
longitude   Float?
timezone    String?

// RunCrew
city        String?
state       String?
country     String?
latitude    Float?
longitude   Float?
timezone    String?

// RunCrewEvent
city        String?
state       String?
country     String?
latitude    Float?
longitude   Float?
timezone    String?
```

### 5.2 Phase 2: Add Structured Pace Fields

```prisma
// Athlete
paceRangeMin  Int? // seconds per mile
paceRangeMax  Int? // seconds per mile
preferredDistance String? // enum or string

// RunCrew
paceRangeMin  Int?
paceRangeMax  Int?

// RunCrewRun
paceMin       Int?
paceMax       Int?
```

### 5.3 Phase 3: Add Tags Arrays

```prisma
// Athlete
tags          String[]

// RunCrew
tags          String[]

// RunCrewRun
tags          String[]

// RunCrewEvent
tags          String[]
```

### 5.4 Phase 4: Add Indexes for Search

```sql
-- Location indexes
CREATE INDEX idx_athlete_location ON "Athlete" (city, state, country);
CREATE INDEX idx_athlete_coords ON "Athlete" USING GIST (point(longitude, latitude));
CREATE INDEX idx_runcrew_location ON "run_crews" (city, state, country);

-- Pace indexes
CREATE INDEX idx_athlete_pace ON "Athlete" (paceRangeMin, paceRangeMax);
CREATE INDEX idx_runcrewrun_pace ON "run_crew_runs" (paceMin, paceMax);

-- Tags indexes (GIN for array search)
CREATE INDEX idx_athlete_tags ON "Athlete" USING GIN (tags);
CREATE INDEX idx_runcrew_tags ON "run_crews" USING GIN (tags);
```

---

## 6. Search Query Examples (Future)

### 6.1 Find Athletes

```typescript
// Find athletes in city with pace range
const athletes = await prisma.athlete.findMany({
  where: {
    city: "Arlington",
    state: "VA",
    paceRangeMin: { lte: 540 }, // 9:00 min/mile
    paceRangeMax: { gte: 480 }, // 8:00 min/mile
    preferredDistance: { in: ["5K", "10K"] }
  }
});

// Proximity search (within 10 miles)
const radius = 10 / 69; // Convert miles to degrees (approx)
const athletes = await prisma.$queryRaw`
  SELECT * FROM "Athlete"
  WHERE (
    3959 * acos(
      cos(radians(${userLat})) *
      cos(radians(latitude)) *
      cos(radians(longitude) - radians(${userLng})) +
      sin(radians(${userLat})) *
      sin(radians(latitude))
    )
  ) < 10
`;
```

### 6.2 Find RunCrews

```typescript
// Find crews by location and pace
const crews = await prisma.runCrew.findMany({
  where: {
    city: "Arlington",
    state: "VA",
    paceRangeMin: { lte: 540 },
    paceRangeMax: { gte: 480 },
    tags: { has: "trail" } // Array contains
  }
});
```

### 6.3 Find Runs

```typescript
// Find runs this weekend, pace range, distance
const runs = await prisma.runCrewRun.findMany({
  where: {
    date: {
      gte: startOfWeekend,
      lte: endOfWeekend
    },
    paceMin: { lte: 540 },
    paceMax: { gte: 480 },
    totalMiles: {
      gte: 5,
      lte: 10
    },
    tags: { has: "social" }
  },
  include: {
    runCrew: {
      select: {
        name: true,
        city: true,
        state: true
      }
    }
  }
});
```

---

## 7. Summary

### Current State
- **Location:** Basic city/state on Athlete, missing on RunCrew/Event
- **Pace:** Text-based, not structured for filtering
- **Tags/Categories:** Missing entirely
- **Timezone:** Missing (except RunCrewRun)
- **Geographic Search:** No lat/lng for proximity

### Recommended Additions (High Priority)
1. **Location:** Add city/state/country/lat/lng to RunCrew and RunCrewEvent
2. **Pace:** Add structured paceRangeMin/Max fields
3. **Tags:** Add tags arrays to all models
4. **Timezone:** Add timezone to Athlete, RunCrew, RunCrewEvent
5. **Preferred Distance:** Add to Athlete for filtering

### Impact
- ✅ Enables location-based search
- ✅ Enables proximity search (within X miles)
- ✅ Enables structured pace filtering
- ✅ Enables tag-based filtering/categorization
- ✅ Enables timezone-aware scheduling
- ✅ Improves discoverability significantly

---

**Next Steps:**
1. Review and prioritize recommendations
2. Design migration strategy
3. Create Prisma schema updates
4. Plan data migration/backfill
5. Update API endpoints for search
6. Update frontend for search UI

