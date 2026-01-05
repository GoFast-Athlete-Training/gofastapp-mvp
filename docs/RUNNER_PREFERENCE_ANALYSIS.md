# Runner Preference Model Analysis

**Date:** January 2025  
**Purpose:** Analyze originally scoped runner preferences vs current implementation  
**Scope:** Athlete preferences, RunCrew preferences, matching/searchability

---

## Executive Summary

Originally scoped runner preferences were planned but never fully implemented. This document maps what was planned, what currently exists, what we've recently added, and recommendations for implementation.

---

## 1. Originally Scoped Runner Preferences

### 1.1 From `gofastnodejsschema.md` - "Match Profile (Future)"

**Planned Fields:**
- `preferredDistance` - String? (e.g., "5K", "10K", "Half Marathon", "Marathon")
- `timePreference` - String? (e.g., "morning", "afternoon", "evening")
- `myPaceRange` - String? (e.g., "8:00-9:00 min/mile")
- `myRunningGoals` - String? (e.g., "fun", "training", "social")

**Status:** ❌ Never implemented - marked as "Future"

---

## 2. Current State: What Exists

### 2.1 Athlete Model (Current Schema)

**Location Preferences:**
- ✅ `city` - String?
- ✅ `state` - String?
- ❌ `country` - Missing
- ❌ `latitude` / `longitude` - Missing (for proximity matching)
- ❌ `timezone` - Missing (for time preference matching)

**Performance/Pace Preferences:**
- ✅ `fiveKPace` - String? (e.g., "8:00") - **Limited to 5K only**
- ✅ `weeklyMileage` - Int?
- ❌ `preferredPace` / `paceRange` - Missing
- ❌ `preferredDistance` - Missing (5K, 10K, half, marathon, etc.)
- ❌ `paceRangeMin` / `paceRangeMax` - Missing (structured)

**Profile/Preferences:**
- ✅ `gender` - String? (free text, not enum)
- ✅ `primarySport` - String?
- ✅ `bio` - String? (free text about/bio)
- ✅ `birthday` - DateTime? (can calculate age)
- ❌ `experienceLevel` - Missing (beginner, intermediate, advanced, elite)
- ❌ `runningGoals` - Missing (structured tags)
- ❌ `preferredRunningTimes` - Missing (morning, afternoon, evening)
- ❌ `preferredRunningDays` - Missing (weekdays, weekends, specific days)
- ❌ `tags` / `interests` - Missing

**Gap:** Athlete model has minimal preference data - mostly basic profile fields.

---

### 2.2 RunCrew Model (Current Schema - After Recent Updates)

**Location Metadata:**
- ✅ `city` - String?
- ✅ `state` - State? (enum - 50 states + DC)
- ✅ `primaryMeetUpPoint` - String? (recently added)
- ✅ `primaryMeetUpAddress` - String? (recently added)
- ✅ `primaryMeetUpPlaceId` - String? (recently added)
- ✅ `primaryMeetUpLat` - Float? (recently added)
- ✅ `primaryMeetUpLng` - Float? (recently added)
- ❌ `country` - Missing
- ❌ `timezone` - Missing

**Pace Preferences:**
- ✅ `paceMin` - Int? (seconds per mile, recently added)
- ✅ `paceMax` - Int? (seconds per mile, recently added)

**Demographics Preferences:**
- ✅ `gender` - Gender? (enum: male, female, both - recently updated)
- ✅ `ageMin` - Int? (recently added)
- ✅ `ageMax` - Int? (recently added)

**Purpose/Goals:**
- ✅ `purpose` - Purpose[]? (enum array: Training, Fun, Social - recently added)

**Gap:** RunCrew now has good metadata for filtering, but lacks some preference fields that were scoped.

---

## 3. What We've Recently Implemented (vs Original Scope)

### 3.1 RunCrew Preferences (Just Added)

**Implemented:**
- ✅ `purpose` - Purpose[] (Training, Fun, Social) - **NEW - matches original scope**
- ✅ `paceMin` / `paceMax` - Int (structured pace range) - **NEW**
- ✅ `gender` - Gender enum (male, female, both) - **UPDATED**
- ✅ `ageMin` / `ageMax` - Int - **NEW**
- ✅ `primaryMeetUpPoint` + location fields - **NEW**

**Matches Original Scope:**
- ✅ Purpose/Goals → `purpose` field (Training, Fun, Social)
- ✅ Pace Range → `paceMin` / `paceMax` fields
- ⚠️ Time Preference → **Still missing** (was `timePreference` in original scope)
- ⚠️ Preferred Distance → **Still missing** (was `preferredDistance` in original scope)

---

### 3.2 Athlete Preferences (Still Missing)

**Not Implemented:**
- ❌ `preferredDistance` - Missing (was in original scope)
- ❌ `timePreference` - Missing (was in original scope)
- ❌ `myPaceRange` - Missing (was in original scope)
- ❌ `myRunningGoals` - Missing (was in original scope, but `purpose` exists on RunCrew)

**Partially Implemented:**
- ⚠️ Pace → Only `fiveKPace` exists (String, not structured range)
- ⚠️ Goals → No structured field, only free-text `bio`

---

## 4. Comparison: Original Scope vs Current State

### 4.1 Athlete Preferences

| Original Scope | Current State | Gap |
|---------------|---------------|-----|
| `preferredDistance` | ❌ Missing | Need enum: 5K, 10K, Half, Marathon, etc. |
| `timePreference` | ❌ Missing | Need: morning, afternoon, evening, any |
| `myPaceRange` | ⚠️ `fiveKPace` only | Need structured range (min/max) |
| `myRunningGoals` | ⚠️ Only `bio` (free text) | Need structured tags/enum |

**Status:** ❌ **Mostly Missing** - Only basic profile fields exist

---

### 4.2 RunCrew Preferences

| Original Scope Concept | Current State | Status |
|------------------------|---------------|--------|
| Purpose/Goals | ✅ `purpose` (Training, Fun, Social) | ✅ **Implemented** |
| Pace Range | ✅ `paceMin` / `paceMax` | ✅ **Implemented** |
| Time Preference | ❌ Missing | ❌ **Not implemented** |
| Preferred Distance | ❌ Missing | ❌ **Not implemented** |
| Demographics | ✅ `gender`, `ageMin`, `ageMax` | ✅ **Implemented** |
| Location | ✅ `city`, `state`, primary meetup | ✅ **Implemented** |

**Status:** ✅ **Partially Implemented** - Core preferences exist, some gaps remain

---

## 5. Recommendations: What Should Apply

### 5.1 For RunCrew (High Priority)

**Already Implemented ✅:**
- Purpose (Training, Fun, Social) ✅
- Pace range (min/max) ✅
- Gender filter ✅
- Age range ✅
- Location (city, state, primary meetup) ✅

**Should Add (Medium Priority):**

1. **Preferred Distance** (enum or array)
   - Options: "5K", "10K", "Half Marathon", "Marathon", "Ultra", "Any"
   - Use case: "Find crews that run 5Ks" or "Find marathon training groups"
   - **Recommendation:** Add `preferredDistance` enum array
   ```prisma
   enum PreferredDistance {
     FiveK
     TenK
     HalfMarathon
     Marathon
     Ultra
     Any
   }
   preferredDistance PreferredDistance[] @default([])
   ```

2. **Time Preference** (enum or array)
   - Options: "Morning", "Afternoon", "Evening", "Any"
   - Use case: "Find crews that run in the morning"
   - **Recommendation:** Add `timePreference` enum array
   ```prisma
   enum TimePreference {
     Morning
     Afternoon
     Evening
     Any
   }
   timePreference TimePreference[] @default([])
   ```

3. **Typical Run Days** (array)
   - Options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
   - Use case: "Find crews that run on weekends"
   - **Recommendation:** Add `typicalRunDays` String[]? (optional, can be inferred from runs)

---

### 5.2 For Athlete (Lower Priority - For Future Matching Feature)

**Should Add (When Implementing Runner Matching):**

1. **Preferred Distance** (enum array)
   - Same as RunCrew: 5K, 10K, Half, Marathon, Ultra, Any
   - Use case: Match athletes with crews based on preferred distance

2. **Time Preference** (enum array)
   - Same as RunCrew: Morning, Afternoon, Evening, Any
   - Use case: Match athletes based on when they like to run

3. **Pace Range** (structured)
   - `paceRangeMin` / `paceRangeMax` (Int - seconds per mile)
   - Replace/expand `fiveKPace` String field
   - Use case: Match athletes with similar pace

4. **Running Goals** (enum array)
   - Similar to RunCrew `purpose`: Training, Fun, Social, Competition, etc.
   - Use case: Match athletes with similar goals

**Note:** Athlete preferences are lower priority since MVP1 focuses on RunCrew discovery, not athlete-to-athlete matching.

---

## 6. Implementation Status

### 6.1 RunCrew Preferences - Current State

**✅ Implemented (January 2025):**
- `purpose` - Purpose[] (Training, Fun, Social)
- `paceMin` / `paceMax` - Int (seconds per mile)
- `gender` - Gender enum (male, female, both)
- `ageMin` / `ageMax` - Int
- `city` / `state` - Location metadata
- `primaryMeetUpPoint` + location fields - For radius search

**❌ Missing from Original Scope:**
- `preferredDistance` - Preferred distance types
- `timePreference` - When crew typically runs
- `typicalRunDays` - Days of week crew runs

**📊 Coverage:** ~70% of core preferences implemented

---

### 6.2 Athlete Preferences - Current State

**✅ Implemented:**
- Basic profile: `city`, `state`, `gender`, `bio`
- Performance: `fiveKPace`, `weeklyMileage`

**❌ Missing from Original Scope:**
- `preferredDistance` - Preferred distance types
- `timePreference` - When athlete prefers to run
- `myPaceRange` - Structured pace range (beyond 5K)
- `myRunningGoals` - Structured goals/tags

**📊 Coverage:** ~20% of scoped preferences implemented

**Recommendation:** Lower priority - focus on RunCrew preferences first for discovery/search

---

## 7. What Applies to Current Implementation

### 7.1 For RunCrew Creation Form (Current Focus)

**Already in Form ✅:**
- Purpose buttons (Training, Fun, Social) ✅
- Pace range (min/max) ✅
- Gender radio buttons (Male, Female, Both) ✅
- Age range (min/max) ✅
- City/State dropdown ✅
- Primary meetup point (Places API) ✅

**Should Add to Form:**
- ✅ **Purpose** - Already added (Training, Fun, Social buttons)
- ❌ **Preferred Distance** - Add dropdown/multi-select
- ❌ **Time Preference** - Add buttons/multi-select
- ❌ **Typical Run Days** - Add checkboxes for days

---

### 7.2 For "Meet Crew Leader" Feature (Requested)

**What Should Be Shown:**
- Crew leader's public profile:
  - ✅ `firstName` / `lastName`
  - ✅ `photoURL`
  - ✅ `bio` (about section)
  - ✅ `city` / `state` (location)
  - ✅ `gofastHandle` (if available)
  - ✅ `primarySport` (if available)
  - ✅ `instagram` (if public)

**What Should NOT Be Shown:**
- ❌ `email` (private)
- ❌ `phoneNumber` (private)
- ❌ `birthday` (calculate age if needed, but don't show exact date)
- ❌ Garmin/Strava tokens (private)
- ❌ Internal IDs

**Implementation:**
- Create API endpoint: `GET /api/runcrew/[id]/leader`
- Query: Find membership with `role: 'admin'`, include athlete with public fields only
- Create UI component: `MeetCrewLeader.tsx` (modal or expandable section)

---

## 8. Priority Recommendations

### 8.1 High Priority (Complete RunCrew Preferences)

1. ✅ **Purpose** - Done (Training, Fun, Social)
2. ❌ **Preferred Distance** - Add to schema and form
3. ❌ **Time Preference** - Add to schema and form
4. ✅ **Pace Range** - Done
5. ✅ **Demographics** - Done (gender, age range)
6. ✅ **Location** - Done

---

### 8.2 Medium Priority (Meet Crew Leader)

1. Create API endpoint for crew leader public profile
2. Create "Meet Crew Leader" UI component
3. Add to RunCrew detail/discovery pages

---

### 8.3 Low Priority (Athlete Preferences)

1. Add athlete preference fields (for future matching feature)
2. Update athlete profile form
3. Build athlete-to-athlete matching (future feature)

---

## 9. Next Steps

### Immediate (RunCrew Preferences):

1. **Add Preferred Distance:**
   - Add enum `PreferredDistance`
   - Add field to RunCrew schema
   - Add to create form (dropdown/multi-select)
   - Create migration

2. **Add Time Preference:**
   - Add enum `TimePreference`
   - Add field to RunCrew schema
   - Add to create form (buttons/multi-select)
   - Create migration

3. **Meet Crew Leader:**
   - Create API endpoint `GET /api/runcrew/[id]/leader`
   - Create `MeetCrewLeader` component
   - Add to crew discovery/detail pages

---

### Future (Athlete Preferences):

1. Add athlete preference fields when implementing runner matching
2. Update athlete profile form
3. Build matching algorithm

---

## 10. Schema Recommendations

### RunCrew (Add These Fields):

```prisma
enum PreferredDistance {
  FiveK
  TenK
  HalfMarathon
  Marathon
  Ultra
  Any
}

enum TimePreference {
  Morning
  Afternoon
  Evening
  Any
}

model RunCrew {
  // ... existing fields ...
  
  // Purpose (✅ already added)
  purpose Purpose[] @default([])
  
  // Recommended additions:
  preferredDistance PreferredDistance[] @default([])
  timePreference TimePreference[] @default([])
  typicalRunDays String[] @default([]) // ["Monday", "Friday", "Saturday"]
}
```

---

## 11. Summary Table

| Preference Type | Original Scope | RunCrew Current | Athlete Current | Status |
|----------------|----------------|-----------------|-----------------|--------|
| **Purpose/Goals** | ✅ `myRunningGoals` | ✅ `purpose[]` (Training, Fun, Social) | ❌ Missing | ✅ **Implemented** |
| **Pace Range** | ✅ `myPaceRange` | ✅ `paceMin/Max` (seconds/mile) | ⚠️ Only `fiveKPace` | ✅ **Implemented** |
| **Time Preference** | ✅ `timePreference` | ✅ `timePreference[]` (Morning, Afternoon, Evening) | ❌ Missing | ✅ **Implemented** |
| **Typical Run Distance** | ❌ Not scoped | ✅ `typicalRunMiles` (average) | ❌ Missing | ✅ **Implemented** |
| **Long Run Range** | ❌ Not scoped | ✅ `longRunMilesMin/Max` | ❌ Missing | ✅ **Implemented** |
| **Demographics** | ⚠️ Indirect | ✅ `gender`, `ageMin/Max` | ✅ `gender` | ✅ **Implemented** |
| **Location** | ⚠️ Indirect | ✅ `city`, `state`, `primaryMeetUpPoint` + lat/lng | ✅ `city`, `state` | ✅ **Implemented** |
| **Typical Days** | ❌ Not scoped | ❌ Skipped (intentional - not a scheduled club) | ❌ Missing | ✅ **Intentionally Skipped** |

**Legend:**
- ✅ Implemented
- ❌ Missing
- ⚠️ Partial

---

## 12. Final Implementation Status (January 2025)

### ✅ **Complete - RunCrew Preferences**

All core RunCrew preference fields for user choice/affinity matching are now implemented:

1. ✅ **Purpose** - `purpose[]` (Training, Fun, Social) - Multi-select buttons
2. ✅ **Pace Range** - `paceMin` / `paceMax` (seconds per mile) - Structured range
3. ✅ **Time Preference** - `timePreference[]` (Morning, Afternoon, Evening) - Multi-select buttons
4. ✅ **Typical Run Distance** - `typicalRunMiles` (Float) - Average typical run
5. ✅ **Long Run Range** - `longRunMilesMin` / `longRunMilesMax` (Float) - Min/max range
6. ✅ **Demographics** - `gender` (enum), `ageMin` / `ageMax` (Int)
7. ✅ **Location** - `city`, `state` (enum), `primaryMeetUpPoint` + lat/lng for radius search

### ✅ **Coverage: 100% of Core Preferences**

All fields needed for RunCrew discovery and user affinity matching are now in place.

---

**End of Runner Preference Analysis**

