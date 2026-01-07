# RunCrew Discovery Page - Filters & Display Analysis

**Date:** 2025-01-XX  
**Page:** `/app/runcrew/page.tsx` (Discovery/Landing Page)

---

## Current Filter State

### ✅ Filters That Exist (UI + Functionality)

1. **Location Filters**
   - **City** (`filterCity`) - Text input
   - **State** (`filterState`) - Text input
   - ✅ UI exists
   - ✅ API sends params
   - ✅ Backend filters work

2. **Purpose Filter** (`filterPurpose`)
   - Options: Training, Fun, Social
   - Multi-select buttons
   - ✅ UI exists
   - ✅ API sends params
   - ✅ Backend filters work
   - ✅ **Special:** When "Training" selected → Shows race filter (new)

3. **Time Preference Filter** (`filterTimePreference`)
   - Options: Morning, Afternoon, Evening
   - Multi-select buttons
   - ✅ UI exists
   - ✅ API sends params
   - ✅ Backend filters work

4. **Gender Filter** (`filterGender`)
   - Options: male, female, both
   - Radio buttons with clear option
   - ✅ UI exists
   - ✅ API sends params
   - ✅ Backend filters work

5. **Age Range Filter**
   - **Min Age** (`filterAgeMin`) - Number input
   - **Max Age** (`filterAgeMax`) - Number input
   - ✅ UI exists
   - ✅ API sends params
   - ✅ Backend filters work

6. **Typical Run Miles Filter**
   - **Min Miles** (`filterTypicalRunMilesMin`) - Number input
   - **Max Miles** (`filterTypicalRunMilesMax`) - Number input
   - ✅ UI exists
   - ✅ API sends params
   - ✅ Backend filters work

7. **Training For Race Filter** (`filterTrainingForRace`) ⚠️ **NEW**
   - Search input with autocomplete
   - Shows when "Training" purpose is selected
   - ✅ UI exists (conditionally shown)
   - ✅ API sends params (`trainingForRace`)
   - ⚠️ **Backend filtering NOT IMPLEMENTED YET**

8. **Training Distance Filter** (`filterTrainingForDistance`) ⚠️ **NEW**
   - Options: FiveK, TenK, HalfMarathon, Marathon, Ultra
   - Multi-select buttons
   - Shows when "Training" purpose is selected
   - ✅ UI exists (conditionally shown)
   - ✅ API sends params (`trainingForDistance`)
   - ⚠️ **Backend filtering NOT IMPLEMENTED YET**

---

## Crew Card Display Analysis

### ✅ Currently Displayed on Crew Cards

**Location:**
```typescript
{(crew.city || crew.state || crew.primaryMeetUpPoint) && (
  <MapPin /> {crew.primaryMeetUpPoint || `${crew.city}, ${crew.state}`}
)}
```

**What Shows:**
1. **Logo/Icon** - Crew graphic
2. **Name** - Crew name
3. **Member Count** - Number of members
4. **Description** - Crew description (line-clamp-2)
5. **Location** - City, State, or Meetup Point (MapPin icon)
6. **Pace Range** - Displayed pace (Target icon)
7. **Time Preference** - Morning/Afternoon/Evening (Clock icon)
8. **Purpose Tags** - Training/Fun/Social badges

### ❌ **MISSING: Race Information**

**What's NOT Displayed:**
- ❌ **Race Name** - If crew is training for a race
- ❌ **Race Date** - When the race is
- ❌ **Race Distance** - Distance of the race
- ❌ **Training Distances** - What distances they're training for

---

## Interface Definition

### Current `DiscoverableRunCrew` Interface

```typescript
interface DiscoverableRunCrew {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  icon: string | null;
  city: string | null;
  state: string | null;
  paceRange: string | null;
  gender: string | null;
  ageRange: string | null;
  primaryMeetUpPoint: string | null;
  primaryMeetUpAddress: string | null;
  purpose: string[] | null;
  timePreference: string[] | null;
  typicalRunMiles: number | null;
  memberCount: number;
  createdAt: Date;
  
  // ❌ MISSING:
  // trainingForRace: string | null;
  // trainingForDistance: string[] | null;
  // race: { id: string; name: string; date: Date; miles: number } | null;
}
```

---

## Backend API Analysis

### Current API Response (`/api/runcrew/discover`)

**What's Returned:**
```typescript
{
  id, name, description, logo, icon, city, state,
  paceRange, gender, ageRange, primaryMeetUpPoint,
  primaryMeetUpAddress, purpose, timePreference,
  typicalRunMiles, memberCount, createdAt
}
```

**What's NOT Returned:**
- ❌ `trainingForRace` (race_registry.id)
- ❌ `trainingForDistance` array
- ❌ Race details (joined from race_registry)

### Domain Function (`lib/domain-runcrew.ts::getDiscoverableRunCrews()`)

**Current Select Statement:**
```typescript
select: {
  id, name, description, logo, icon, city, state,
  easyMilesPace, crushingItPace, gender, ageMin, ageMax,
  primaryMeetUpPoint, primaryMeetUpAddress,
  purpose, timePreference, typicalRunMiles, createdAt,
  _count: { select: { run_crew_memberships: true } }
}
```

**Missing:**
- ❌ `trainingForRace`
- ❌ `trainingForDistance`
- ❌ `race_registry` relation (to get race name, date, etc.)

---

## Issues Identified

### 1. **Filter UI Exists But Backend Doesn't Filter** ⚠️

**Problem:**
- Frontend sends `trainingForRace` and `trainingForDistance` params
- Backend API accepts them in query params
- BUT `getDiscoverableRunCrews()` doesn't use them in where clause

**Files to Update:**
- `app/api/runcrew/discover/route.ts` - Parse params ✅ (already done)
- `lib/domain-runcrew.ts::getDiscoverableRunCrews()` - Add to where clause ❌

### 2. **Race Info Not Returned** ❌

**Problem:**
- Database has `trainingForRace` and `trainingForDistance` fields
- Frontend interface doesn't include them
- Backend doesn't return them
- Crew cards can't display race info

**Files to Update:**
- `lib/domain-runcrew.ts::getDiscoverableRunCrews()` - Include in select ❌
- `app/runcrew/page.tsx` - Update interface ❌
- `app/runcrew/page.tsx` - Display race info on cards ❌

### 3. **City Shown But Race Not Shown** ❌

**UX Gap:**
- Users can see crew location (city/state)
- Users can filter by race
- But users CAN'T see what race a crew is training for on the card

**Impact:**
- Users filter by race but can't verify which crews match
- Missing key information for decision-making
- Inconsistent: can filter by it but can't see it

---

## Recommended Changes

### Phase 1: Add Backend Filtering

**File:** `lib/domain-runcrew.ts`

```typescript
export async function getDiscoverableRunCrews(options?: {
  // ... existing options
  trainingForRace?: string;
  trainingForDistance?: string[];
}) {
  // ... existing where clause
  
  // Add race filtering
  if (options?.trainingForRace) {
    where.trainingForRace = options.trainingForRace;
  }
  
  if (options?.trainingForDistance && options.trainingForDistance.length > 0) {
    where.trainingForDistance = {
      hasSome: options.trainingForDistance,
    };
  }
  
  // Include race relation
  const crews = await prisma.run_crews.findMany({
    where,
    include: {
      race_registry: {
        select: {
          id: true,
          name: true,
          date: true,
          miles: true,
          city: true,
          state: true,
        }
      },
      // ... rest of select
    }
  });
}
```

### Phase 2: Update Response Format

**File:** `lib/domain-runcrew.ts`

```typescript
return crews.map((crew) => {
  return {
    // ... existing fields
    trainingForRace: crew.trainingForRace,
    trainingForDistance: crew.trainingForDistance,
    race: crew.race_registry ? {
      id: crew.race_registry.id,
      name: crew.race_registry.name,
      date: crew.race_registry.date,
      miles: crew.race_registry.miles,
      city: crew.race_registry.city,
      state: crew.race_registry.state,
    } : null,
  };
});
```

### Phase 3: Update Frontend Interface

**File:** `app/runcrew/page.tsx`

```typescript
interface DiscoverableRunCrew {
  // ... existing fields
  trainingForRace: string | null;
  trainingForDistance: string[] | null;
  race: {
    id: string;
    name: string;
    date: Date;
    miles: number;
    city: string | null;
    state: string | null;
  } | null;
}
```

### Phase 4: Display Race Info on Cards

**File:** `app/runcrew/page.tsx` (in crew card rendering)

```typescript
{/* Race Information */}
{crew.race && (
  <div className="flex items-center gap-2 text-sm text-orange-600 font-medium">
    <Target className="w-4 h-4" />
    <span>Training for: {crew.race.name}</span>
    <span className="text-xs text-gray-500">
      ({formatRaceDate(crew.race.date)} • {crew.race.miles} miles)
    </span>
  </div>
)}

{/* Training Distances */}
{crew.trainingForDistance && crew.trainingForDistance.length > 0 && (
  <div className="flex flex-wrap gap-1 pt-1">
    {crew.trainingForDistance.map((distance, idx) => (
      <span
        key={idx}
        className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
      >
        {distance.replace(/([A-Z])/g, ' $1').trim()}
      </span>
    ))}
  </div>
)}
```

---

## Filter Summary

| Filter | UI Exists | Backend Accepts | Backend Filters | Displayed on Card |
|--------|-----------|-----------------|-----------------|-------------------|
| City | ✅ | ✅ | ✅ | ✅ |
| State | ✅ | ✅ | ✅ | ✅ |
| Purpose | ✅ | ✅ | ✅ | ✅ |
| Time Preference | ✅ | ✅ | ✅ | ✅ |
| Gender | ✅ | ✅ | ✅ | ❌ |
| Age Range | ✅ | ✅ | ✅ | ❌ |
| Typical Run Miles | ✅ | ✅ | ✅ | ❌ |
| **Training For Race** | ✅ | ✅ | ❌ | ❌ |
| **Training Distance** | ✅ | ✅ | ❌ | ❌ |

---

## Action Items

1. ⏳ **Add backend filtering** for `trainingForRace` and `trainingForDistance`
2. ⏳ **Include race relation** in `getDiscoverableRunCrews()` select
3. ⏳ **Update response format** to include race data
4. ⏳ **Update frontend interface** to include race fields
5. ⏳ **Display race info** on crew cards (similar to city display)
6. ⏳ **Display training distances** as badges on cards

---

## Comparison: City vs Race

### City Display
- ✅ Shows on card with MapPin icon
- ✅ Filterable
- ✅ Helps users find local crews

### Race Display (MISSING)
- ❌ NOT shown on card
- ✅ Filterable (but backend doesn't work)
- ❌ Users can't verify if crew matches their race goals

**Conclusion:** Race info should be displayed like city info - it's equally important for discovery!

