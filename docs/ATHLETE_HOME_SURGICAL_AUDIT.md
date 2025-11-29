# AthleteHome Migration - Surgical Code Audit

**Date**: January 2025  
**Method**: Direct code inspection - No assumptions, only real code patterns

---

## 1. EXACT CODE PATTERNS FOUND IN EACH FILE

### OLD APP: `gofastfrontend-mvp1/src/Pages/Athlete/AthleteHome.jsx`

#### **Imported Modules**
```javascript
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { LocalStorageAPI } from '../../config/LocalStorageConfig';
import useHydratedAthlete from '../../hooks/useHydratedAthlete';
import useActivities from '../../hooks/useActivities';
import api from '../../api/axiosConfig';
import { Activity, Users, Settings, MapPin, Clock, Calendar } from 'lucide-react';
```

#### **Constants**
```javascript
const API_BASE = 'https://gofastbackendv2-fall2025.onrender.com/api';
```

#### **Local State Variables**
```javascript
const navigate = useNavigate();
const { athlete: athleteProfile, athleteId, runCrewId, runCrewManagerId, runCrew } = useHydratedAthlete();
const { activities: weeklyActivities, weeklyTotals, isLoading: activitiesLoading } = useActivities(athleteId);
const isCrewAdmin = useMemo(() => Boolean(runCrewManagerId), [runCrewManagerId]);
const [crew, setCrew] = useState(runCrew);
const [garminConnected, setGarminConnected] = useState(false);
const [checkingConnection, setCheckingConnection] = useState(true);
const [isHydratingCrew, setIsHydratingCrew] = useState(false);
```

#### **localStorage Keys Accessed**
- `athleteProfile` - via `useHydratedAthlete` hook → `LocalStorageAPI.getAthleteProfile()`
- `athleteId` - via `useHydratedAthlete` hook → `LocalStorageAPI.getAthleteId()`
- `MyCrew` - via `useHydratedAthlete` hook → `LocalStorageAPI.getMyCrew()`
- `runCrewId` - via `useHydratedAthlete` hook → `LocalStorageAPI.getRunCrewId()`
- `runCrewData` - via `useHydratedAthlete` hook → `LocalStorageAPI.getRunCrewData()`
- `weeklyActivities` - via `useActivities` hook → `LocalStorageAPI.getFullHydrationModel().weeklyActivities`
- `weeklyTotals` - via `useActivities` hook → `LocalStorageAPI.getFullHydrationModel().weeklyTotals`

#### **API Endpoints Called**
1. `POST /runcrew/hydrate` - Body: `{ runCrewId, athleteId }`
   - Used: Line 47
   - Response shape: `{ success: boolean, runCrew: {...} }`

2. `GET /garmin/status?athleteId=${athleteId}` - Query param
   - Used: Line 73
   - Response shape: `{ connected: boolean }`
   - Direct fetch, NOT via api axios instance

3. `GET /athlete/${athleteId}/activities/weekly?period=current` - Called by `useActivities` hook
   - Response shape: `{ success: boolean, activities: Activity[], weeklyTotals: {...}, periodLabel: string }`

#### **Shape of Returned Data**

**useHydratedAthlete returns:**
```typescript
{
  athlete: AthleteProfile | null,
  athleteId: string | null,
  runCrewId: string | null,
  runCrewManagerId: string | null,
  runCrew: RunCrew | null
}
```

**useActivities returns:**
```typescript
{
  activities: Activity[],
  weeklyTotals: {
    totalDistance: number,
    totalDistanceMiles: number,
    totalDuration: number,
    totalCalories: number,
    activityCount: number
  } | null,
  isLoading: boolean,
  error: string | null,
  refresh: () => void,
  periodLabel: string
}
```

**AthleteProfile shape (from localStorage):**
```typescript
{
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  photoURL?: string,
  city?: string,
  state?: string,
  primarySport?: string,
  bio?: string,
  // ... other fields
}
```

**RunCrew shape (from localStorage or API):**
```typescript
{
  id: string,
  name: string,
  description?: string,
  icon?: string,
  logo?: string,
  runs: Run[],
  memberships: Membership[],
  announcements: Announcement[],
  messages: Message[],
  leaderboardDynamic: LeaderboardEntry[]
}
```

**Run shape:**
```typescript
{
  id: string,
  title?: string,
  date?: string | Date,
  scheduledAt?: string | Date,
  time?: string,
  startTime?: string,
  meetUpPoint?: string,
  meetUpAddress?: string,
  totalMiles?: number,
  pace?: string,
  description?: string,
  stravaMapUrl?: string,
  rsvps: RSVP[]
}
```

**RSVP shape:**
```typescript
{
  athleteId: string,
  athlete?: AthleteProfile,
  name?: string,
  photoURL?: string,
  status: 'going' | 'not-going' | 'maybe'
}
```

**Activity shape:**
```typescript
{
  id: string,
  activityType: string,
  distance: number, // meters
  duration: number, // seconds
  calories?: number,
  pace?: number | string, // seconds per mile OR formatted string
  startTime: string | Date,
  detailData?: any
}
```

**WeeklyTotals shape:**
```typescript
{
  totalDistance: number, // meters
  totalDistanceMiles: number, // calculated
  totalDuration: number, // seconds
  totalCalories: number,
  activityCount: number
}
```

#### **Conditional Logic**

**Line 33-39: RunCrew or Bust Redirect**
```javascript
if (athleteProfile && !runCrewId) {
  navigate('/runcrew/join-or-start', { replace: true });
  return;
}
```

**Line 44: Crew Hydration Condition**
```javascript
if (runCrewId && athleteId && !crew && !isHydratingCrew) {
  // Hydrate crew
}
```

**Line 228: Crew Display Condition**
```javascript
{crew && runCrewId ? (
  // Hero crew section
) : (
  // Join/create crew prompt
)}
```

**Line 243: Next Run Condition**
```javascript
{nextRun ? (
  // Next run card
) : (
  // No upcoming runs
)}
```

**Line 317: Weekly Stats Condition**
```javascript
{garminConnected && weeklyTotals && (
  // Weekly stats card
)}
```

**Line 350: Garmin Connection Prompt Condition**
```javascript
{!checkingConnection && !garminConnected && (
  // Connection prompt
)}
```

**Line 369: Latest Activity Condition**
```javascript
{latestActivity && (
  // Latest activity card
)}
```

**Line 406: RSVP CTA Condition**
```javascript
{crew && nextRun && (
  // RSVP CTA card
)}
```

#### **Computed Values**

**nextRun (Lines 89-103):**
```javascript
const nextRun = useMemo(() => {
  if (!crew?.runs || !Array.isArray(crew.runs)) return null;
  const upcomingRuns = crew.runs
    .filter((run) => {
      const runDate = run.date || run.scheduledAt;
      if (!runDate) return false;
      return new Date(runDate) >= new Date();
    })
    .sort((a, b) => {
      const dateA = new Date(a.date || a.scheduledAt);
      const dateB = new Date(b.date || b.scheduledAt);
      return dateA - dateB;
    });
  return upcomingRuns[0] || null;
}, [crew]);
```

**nextRunAttendees (Lines 106-112):**
```javascript
const nextRunAttendees = useMemo(() => {
  if (!nextRun?.rsvps) return [];
  return nextRun.rsvps
    .filter(rsvp => rsvp.status === 'going')
    .slice(0, 3)
    .map(rsvp => rsvp.athlete || rsvp);
}, [nextRun]);
```

**latestActivity (Lines 115-118):**
```javascript
const latestActivity = useMemo(() => {
  if (!weeklyActivities || weeklyActivities.length === 0) return null;
  return weeklyActivities[0]; // Already sorted by date desc
}, [weeklyActivities]);
```

**isCrewAdmin (Lines 23-25):**
```javascript
const isCrewAdmin = useMemo(() => {
  return Boolean(runCrewManagerId);
}, [runCrewManagerId]);
```

#### **Navigation Patterns**

**Routes navigated to:**
- `/runcrew/join-or-start` - Lines 36, 156, 308
- `/athlete-profile` - Line 186
- `/settings` - Line 206, 359
- `/crew/crewadmin` - Line 159 (admin)
- `/runcrew/central` - Line 159 (non-admin)
- `/my-activities` - Line 341
- `/activity/${latestActivity.id}` - Line 371
- `/` - Line 148 (sign out)

**Navigation methods:**
- `navigate(route, { replace: true })` - Redirects
- `navigate(route)` - Normal navigation
- Direct `onClick` handlers

#### **Helper Functions Used**

**formatPace (Lines 121-131):**
```javascript
const formatPace = (activity) => {
  if (!activity.pace) return null;
  if (typeof activity.pace === 'string') return activity.pace;
  if (typeof activity.pace === 'number') {
    const minutes = Math.floor(activity.pace / 60);
    const seconds = Math.floor(activity.pace % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
  }
  return null;
};
```

**formatDistance (Lines 134-142):**
```javascript
const formatDistance = (activity) => {
  if (!activity.distance) return null;
  if (typeof activity.distance === 'number') {
    const miles = activity.distance / 1609.34;
    return `${miles.toFixed(1)} miles`;
  }
  return activity.distance;
};
```

**handleSignOut (Lines 144-152):**
```javascript
const handleSignOut = async () => {
  try {
    await signOut(auth);
    LocalStorageAPI.clearAll();
    navigate('/');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};
```

**handleGoToCrew (Lines 154-161):**
```javascript
const handleGoToCrew = () => {
  if (!runCrewId) {
    navigate('/runcrew/join-or-start');
    return;
  }
  const targetRoute = isCrewAdmin ? '/crew/crewadmin' : '/runcrew/central';
  navigate(targetRoute);
};
```

#### **Data Structures Required**

1. **Crew runs array** - Must have `runs` property that is an array
2. **Run date fields** - Must support both `date` and `scheduledAt` properties
3. **RSVP structure** - Must have `rsvps` array with `status` and `athlete` properties
4. **Weekly activities** - Must be sorted descending by date
5. **Activity pace** - Must support both number (seconds) and string formats
6. **Activity distance** - Must be in meters (number) or formatted string

---

### OLD APP: `gofastfrontend-mvp1/src/hooks/useHydratedAthlete.js`

#### **Imported Modules**
```javascript
import { LocalStorageAPI } from '../config/LocalStorageConfig';
```

#### **Local Storage Keys Read**
- `athleteProfile` - via `LocalStorageAPI.getAthleteProfile()`
- `athleteId` - via `LocalStorageAPI.getAthleteId()`
- `MyCrew` - via `LocalStorageAPI.getMyCrew()`
- `MyCrewManagerId` - via `LocalStorageAPI.getMyCrewManagerId()`
- `runCrewId` - via `LocalStorageAPI.getRunCrewId()` (legacy)
- `runCrewManagerId` - via `LocalStorageAPI.getRunCrewManagerId()` (legacy)
- `runCrewData` - via `LocalStorageAPI.getRunCrewData()`

#### **Logic Pattern**
```javascript
// V2 keys (preferred) with legacy fallback
const myCrew = LocalStorageAPI.getMyCrew();
const myCrewManagerId = LocalStorageAPI.getMyCrewManagerId();
const legacyRunCrewId = LocalStorageAPI.getRunCrewId();
const legacyRunCrewManagerId = LocalStorageAPI.getRunCrewManagerId();

// Use V2 keys if available, otherwise fall back to legacy
const runCrewId = myCrew || legacyRunCrewId || null;
const runCrewManagerId = myCrewManagerId || legacyRunCrewManagerId || null;
```

#### **Return Shape**
```typescript
{
  athlete: any | null,
  athleteId: string | null,
  runCrewId: string | null,
  runCrewManagerId: string | null,
  runCrew: any | null
}
```

**Key Point**: This hook reads from localStorage on EVERY render (no caching). Always fresh.

---

### OLD APP: `gofastfrontend-mvp1/src/hooks/useActivities.js`

#### **Imported Modules**
```javascript
import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { LocalStorageAPI } from '../config/LocalStorageConfig';
```

#### **Local Functions**

**filterRunningActivities (Lines 10-18):**
```javascript
const filterRunningActivities = (activities) => {
  if (!Array.isArray(activities)) return [];
  return activities.filter(activity => {
    if (!activity.activityType) return false;
    const type = activity.activityType.toLowerCase();
    return (type.includes('running') || type === 'run') && !type.includes('wheelchair');
  });
};
```

**calculateRunTotals (Lines 25-43):**
```javascript
const calculateRunTotals = (activities) => {
  const totals = {
    totalDistance: 0,
    totalDuration: 0,
    totalCalories: 0,
    activityCount: activities.length
  };
  
  activities.forEach(activity => {
    if (activity.distance) totals.totalDistance += activity.distance;
    if (activity.duration) totals.totalDuration += activity.duration;
    if (activity.calories) totals.totalCalories += activity.calories;
  });
  
  totals.totalDistanceMiles = totals.totalDistance / 1609.34;
  
  return totals;
};
```

#### **API Endpoint Called**
- `GET /athlete/${athleteId}/activities/weekly?period=${period}`
- Params: `period` (default: 'current')
- Response: `{ success: boolean, activities: Activity[], weeklyTotals: {...}, periodLabel: string }`

#### **localStorage Keys Accessed**
- `weeklyActivities` - via `LocalStorageAPI.getFullHydrationModel().weeklyActivities`
- `weeklyTotals` - via `LocalStorageAPI.getFullHydrationModel().weeklyTotals`

#### **Cache Logic Pattern**
```javascript
// For 'current' period only:
// 1. Check localStorage first
if (period === 'current' && !forceRefresh) {
  const model = LocalStorageAPI.getFullHydrationModel();
  const cachedActivities = model?.weeklyActivities || [];
  if (cachedActivities.length > 0) {
    // Filter and return cached data immediately
    // Then fetch in background to update cache
  }
}
// 2. Fetch from backend
// 3. Filter to runs only
// 4. Recalculate totals
// 5. Update localStorage (for 'current' period only)
```

#### **Return Shape**
```typescript
{
  activities: Activity[],
  weeklyTotals: {
    totalDistance: number,
    totalDistanceMiles: number,
    totalDuration: number,
    totalCalories: number,
    activityCount: number
  } | null,
  isLoading: boolean,
  error: string | null,
  refresh: () => void,
  periodLabel: string
}
```

---

### OLD APP: `gofastfrontend-mvp1/src/config/LocalStorageConfig.js`

#### **Storage Keys Defined**
```javascript
export const STORAGE_KEYS = {
  athleteProfile: 'athleteProfile',
  athleteId: 'athleteId',
  MyCrew: 'MyCrew',
  MyCrewManagerId: 'MyCrewManagerId',
  runCrewId: 'runCrewId',
  runCrewManagerId: 'runCrewManagerId',
  runCrewData: 'runCrewData',
  runCrewMemberships: 'runCrewMemberships',
  runCrewManagers: 'runCrewManagers',
  weeklyActivities: 'weeklyActivities',
  weeklyTotals: 'weeklyTotals',
  hydrationVersion: 'hydrationVersion'
};
```

#### **Methods Used by AthleteHome**
- `getAthleteProfile()` - Returns parsed JSON or null
- `getAthleteId()` - Returns string or null
- `getMyCrew()` - Returns string or null (V2 key)
- `getMyCrewManagerId()` - Returns string or null (V2 key)
- `getRunCrewId()` - Returns string or null (legacy)
- `getRunCrewManagerId()` - Returns string or null (legacy)
- `getRunCrewData()` - Returns parsed JSON or null
- `setRunCrewData(crew)` - Stores JSON stringified crew
- `getFullHydrationModel()` - Returns complete model with athlete, activities, totals
- `setFullHydrationModel(model)` - Stores complete model
- `clearAll()` - Clears entire localStorage

---

### NEW APP: `gofastapp-mvp/app/athlete-home/page.tsx`

#### **Imported Modules**
```typescript
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
```

#### **Local State Variables**
```typescript
const router = useRouter();
const [loading, setLoading] = useState(true);
const [athlete, setAthlete] = useState<any>(null);
const [crews, setCrews] = useState<any[]>([]);
const [primaryCrew, setPrimaryCrew] = useState<any>(null);
const [error, setError] = useState<string | null>(null);
```

#### **localStorage Keys Accessed**
- `athlete` - via `LocalStorageAPI.getAthlete()`
- `crews` - via `LocalStorageAPI.getCrews()`

#### **API Endpoints Called**
- `POST /runcrew/hydrate` - Body: `{ runCrewId }` (Line 65)
  - Response: `{ success: boolean, runCrew: {...} }`

#### **Missing Logic**
- ❌ No `useHydratedAthlete` hook
- ❌ No `useActivities` hook
- ❌ No Garmin connection check
- ❌ No next run calculation
- ❌ No latest activity logic
- ❌ No weekly totals display
- ❌ No formatPace/formatDistance helpers
- ❌ No "RunCrew or Bust" redirect
- ❌ No crew hydration conditional logic
- ❌ No header UI
- ❌ No hero crew section
- ❌ No weekly stats card
- ❌ No Garmin connection prompt
- ❌ No latest activity card
- ❌ No RSVP CTA card

#### **Current UI Structure**
- Basic grid layout (3 columns)
- Simple card components
- Basic navigation buttons
- No conditional rendering based on data
- No computed values

---

### NEW APP: `gofastapp-mvp/lib/localstorage.ts`

#### **Methods Available**
```typescript
setAthlete(athlete: any)
getAthlete()
setAthleteId(id: string)
getAthleteId()
setAthleteProfile(athlete: any)
getAthleteProfile()
setCrews(crews: any[])
getCrews()
setHydrationTimestamp(timestamp: number)
getHydrationTimestamp()
setPrimaryCrew(crew: any)
getPrimaryCrew()
setFullHydrationModel(model: { athlete: any; weeklyActivities?: any[]; weeklyTotals?: any })
```

#### **Missing Methods (compared to old app)**
- ❌ `getRunCrewData()`
- ❌ `setRunCrewData(crew)`
- ❌ `getMyCrew()`
- ❌ `getMyCrewManagerId()`
- ❌ `getRunCrewId()` (legacy)
- ❌ `getRunCrewManagerId()` (legacy)
- ❌ `getFullHydrationModel()` - Returns complete model
- ❌ `clearRunCrewData()`
- ❌ `clearAll()`

#### **Storage Keys Used**
- `athlete`
- `athleteProfile`
- `athleteId`
- `crews`
- `primaryCrew`
- `hydrationTimestamp`
- `weeklyActivities` (set but no getter)
- `weeklyTotals` (set but no getter)

#### **Key Differences**
- New app uses `'athlete'` key (dual-set with `athleteProfile`)
- New app uses `'crews'` array (not `runCrewData`)
- New app uses `'primaryCrew'` (not `runCrewData`)
- New app MISSING V2 crew keys (`MyCrew`, `MyCrewManagerId`)
- New app MISSING legacy crew keys (`runCrewId`, `runCrewManagerId`)
- New app MISSING `getFullHydrationModel()` - critical for activities hook

---

### NEW APP: `gofastapp-mvp/lib/api.ts`

#### **Configuration**
```typescript
baseURL: process.env.NEXT_PUBLIC_API_URL || '/api'
```

**Difference**: New app uses relative `/api` (Next.js API routes), old app uses absolute URL.

#### **Interceptor Pattern**
- ✅ Same Firebase token injection pattern
- ✅ Same `getIdToken(true)` force refresh
- ❌ No response interceptor for 401 handling
- ❌ No token refresh retry logic

---

## 2. TRUE DIFF: OLD APP vs NEW APP

### File-by-File Comparison

#### **AthleteHome Component**

**OLD: `AthleteHome.jsx`**
- 436 lines
- Uses `useHydratedAthlete` hook
- Uses `useActivities` hook
- Has header with logo, profile, settings, sign out
- Has hero Run Crew section (gradient card)
- Has weekly stats card
- Has Garmin connection prompt
- Has latest activity card
- Has RSVP CTA card
- Has formatPace/formatDistance helpers
- Has nextRun calculation
- Has nextRunAttendees calculation
- Has latestActivity calculation
- Has "RunCrew or Bust" redirect
- Has crew hydration logic
- Has Garmin connection check
- Conditional rendering for all sections

**NEW: `athlete-home/page.tsx`**
- 174 lines
- ❌ NO `useHydratedAthlete` hook - uses direct `LocalStorageAPI.getAthlete()`
- ❌ NO `useActivities` hook
- ❌ NO header UI
- ❌ NO hero Run Crew section
- ❌ NO weekly stats card
- ❌ NO Garmin connection prompt
- ❌ NO latest activity card
- ❌ NO RSVP CTA card
- ❌ NO formatPace/formatDistance helpers
- ❌ NO nextRun calculation
- ❌ NO nextRunAttendees calculation
- ❌ NO latestActivity calculation
- ❌ NO "RunCrew or Bust" redirect
- ⚠️ Has crew hydration logic (different pattern)
- ❌ NO Garmin connection check
- Basic grid layout only

**Missing Logic in New App:**
- `nextRun` calculation (filter upcoming runs, sort by date)
- `nextRunAttendees` calculation (first 3 "going" RSVPs)
- `latestActivity` calculation (first activity from sorted array)
- `isCrewAdmin` calculation (boolean from runCrewManagerId)
- Garmin connection status check (API call to `/garmin/status`)
- Crew hydration conditional (only if runCrewId exists but no crew data)
- "RunCrew or Bust" redirect (if athleteProfile exists but no runCrewId)

#### **Hooks**

**OLD: `useHydratedAthlete.js`**
- ✅ EXISTS - 34 lines
- Reads from localStorage on every render
- Returns: `{ athlete, athleteId, runCrewId, runCrewManagerId, runCrew }`
- Uses V2 keys with legacy fallback

**NEW: `hooks/` directory**
- ❌ DOES NOT EXIST - no hooks directory
- ❌ NO equivalent hook

**Missing in New App:**
- Entire hook implementation
- V2 key support (`MyCrew`, `MyCrewManagerId`)
- Legacy key fallback
- Direct localStorage reads on every render

**OLD: `useActivities.js`**
- ✅ EXISTS - 182 lines
- Filters to running activities only
- Calculates weekly totals
- Loads from localStorage first (for 'current' period)
- Fetches from backend if cache empty
- Background refresh after loading from cache
- Updates localStorage cache

**NEW: `hooks/` directory**
- ❌ DOES NOT EXIST - no hooks directory
- ❌ NO equivalent hook

**Missing in New App:**
- Entire hook implementation
- Activity filtering logic
- Weekly totals calculation
- Cache-first loading pattern
- Background refresh logic

#### **localStorage API**

**OLD: `LocalStorageConfig.js`**
- 338 lines
- Has V2 keys (`MyCrew`, `MyCrewManagerId`)
- Has legacy keys (`runCrewId`, `runCrewManagerId`)
- Has `getRunCrewData()` / `setRunCrewData()`
- Has `getFullHydrationModel()` / `setFullHydrationModel()`
- Has `clearRunCrewData()`
- Has `clearAll()`

**NEW: `localstorage.ts`**
- 135 lines
- ❌ NO V2 keys
- ❌ NO legacy keys
- ❌ NO `getRunCrewData()` / `setRunCrewData()`
- ⚠️ Has `setFullHydrationModel()` but ❌ NO `getFullHydrationModel()`
- ❌ NO `clearRunCrewData()`
- ❌ NO `clearAll()`
- Uses different key naming (`crews` array vs `runCrewData`)

**Missing Methods in New App:**
- `getRunCrewData()` - Returns full crew object
- `setRunCrewData(crew)` - Stores full crew object
- `getMyCrew()` - Returns primary crew ID (V2)
- `getMyCrewManagerId()` - Returns manager ID (V2)
- `getRunCrewId()` - Returns crew ID (legacy)
- `getRunCrewManagerId()` - Returns manager ID (legacy)
- `getFullHydrationModel()` - Returns complete hydration model
- `clearRunCrewData()` - Clears all crew-related keys
- `clearAll()` - Clears entire localStorage

#### **Helper Functions**

**OLD: Inline in AthleteHome.jsx**
- ✅ `formatPace(activity)` - Lines 121-131
- ✅ `formatDistance(activity)` - Lines 134-142

**NEW: `athlete-home/page.tsx`**
- ❌ NO formatPace function
- ❌ NO formatDistance function

**Missing in New App:**
- Both helper functions
- Pace conversion logic (seconds → min:sec/mi)
- Distance conversion logic (meters → miles)

---

## 3. MISSING FUNCTIONALITY IN NEW APP

### Missing Hooks

1. **`useHydratedAthlete`**
   - Reads athlete/crew from localStorage
   - Returns: `{ athlete, athleteId, runCrewId, runCrewManagerId, runCrew }`
   - Uses V2 keys with legacy fallback
   - Reads on every render (always fresh)

2. **`useActivities`**
   - Fetches weekly activities
   - Filters to running activities only
   - Calculates weekly totals
   - Cache-first loading pattern
   - Background refresh logic
   - Returns: `{ activities, weeklyTotals, isLoading, error, refresh, periodLabel }`

### Missing Helpers

1. **`formatPace(activity)`**
   - Converts seconds per mile to `min:sec/mi` format
   - Handles both number and string inputs
   - Returns null if no pace

2. **`formatDistance(activity)`**
   - Converts meters to miles
   - Formats to 1 decimal place
   - Returns null if no distance

### Missing localStorage Keys

1. **V2 Keys:**
   - `MyCrew` - Primary crew ID
   - `MyCrewManagerId` - Manager record ID

2. **Legacy Keys:**
   - `runCrewId` - Crew ID (backward compatibility)
   - `runCrewManagerId` - Manager ID (backward compatibility)

3. **Crew Data:**
   - `runCrewData` - Full crew object

4. **Hydration Model:**
   - `getFullHydrationModel()` - Complete model getter

### Missing localStorage Methods

1. `getRunCrewData()` - Get full crew object
2. `setRunCrewData(crew)` - Store full crew object
3. `getMyCrew()` - Get V2 primary crew ID
4. `getMyCrewManagerId()` - Get V2 manager ID
5. `getRunCrewId()` - Get legacy crew ID
6. `getRunCrewManagerId()` - Get legacy manager ID
7. `getFullHydrationModel()` - Get complete hydration model
8. `clearRunCrewData()` - Clear all crew keys
9. `clearAll()` - Clear entire localStorage

### Missing Hydration Logic

1. **Crew Hydration Conditional:**
   ```javascript
   if (runCrewId && athleteId && !crew && !isHydratingCrew) {
     // Call POST /runcrew/hydrate
     // Store result with LocalStorageAPI.setRunCrewData()
   }
   ```

2. **RunCrew or Bust Redirect:**
   ```javascript
   if (athleteProfile && !runCrewId) {
     navigate('/runcrew/join-or-start', { replace: true });
   }
   ```

### Missing Garmin Connection Logic

1. **Connection Check:**
   - API call: `GET /garmin/status?athleteId=${athleteId}`
   - State: `garminConnected`, `checkingConnection`
   - Conditional rendering based on status

### Missing UI Sections

1. **Header:**
   - Logo image
   - Profile avatar button (with fallback initial)
   - Settings button with icon
   - Sign out button

2. **Hero Run Crew Section:**
   - Gradient background (sky-500 to sky-600)
   - Crew name, description, icon
   - Next run card (if exists)
   - Next run date/time
   - Next run location
   - Attendee avatars (first 3)
   - "View Crew" button
   - Empty state: "Join or Create a Run Crew"

3. **Weekly Stats Card:**
   - Total miles (formatted)
   - Activity count
   - Total calories
   - "View All Activities" link
   - Conditional on `garminConnected && weeklyTotals`

4. **Garmin Connection Prompt:**
   - Activity icon
   - Connection prompt text
   - "Connect →" button
   - Conditional on `!checkingConnection && !garminConnected`

5. **Latest Activity Card:**
   - Activity icon
   - Distance, pace, date/time
   - Clickable to activity detail
   - Conditional on `latestActivity` exists

6. **RSVP CTA Card:**
   - Orange-themed styling
   - "RSVP now" message
   - Run date
   - RSVP button
   - Conditional on `crew && nextRun` exist

### Missing Computed Values

1. **`nextRun`** - Filter upcoming runs, sort by date, return first
2. **`nextRunAttendees`** - Filter "going" RSVPs, slice first 3
3. **`latestActivity`** - First activity from sorted array
4. **`isCrewAdmin`** - Boolean from `runCrewManagerId`

### Missing Navigation Routes

1. `/runcrew/join-or-start` - Join or create crew flow
2. `/crew/crewadmin` - Admin crew dashboard (if admin)
3. `/runcrew/central` - Non-admin crew view (if not admin)
4. `/my-activities` - Activities list page
5. `/activity/:id` - Activity detail page

### Missing React Logic

1. **useMemo hooks** - For computed values (nextRun, nextRunAttendees, latestActivity, isCrewAdmin)
2. **useEffect hooks** - For crew hydration, Garmin check, redirects
3. **Conditional rendering** - For all UI sections
4. **Event handlers** - handleSignOut, handleGoToCrew

### Missing API Wiring

1. **Garmin Status:**
   - Endpoint: `GET /garmin/status?athleteId=${athleteId}`
   - Direct fetch (not via api instance)
   - Response: `{ connected: boolean }`

2. **Activities Weekly:**
   - Endpoint: `GET /athlete/${athleteId}/activities/weekly?period=current`
   - Called by useActivities hook
   - Response: `{ success, activities, weeklyTotals, periodLabel }`

---

## 4. EXACT SHAPE OF OBJECTS

### AthleteProfile
```typescript
{
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  photoURL?: string,
  city?: string,
  state?: string,
  primarySport?: string,
  bio?: string,
  // From hydration model:
  MyCrew?: string, // V2 primary crew ID
  MyCrewManagerId?: string, // V2 manager ID
  runCrewMemberships?: Membership[],
  runCrewManagers?: Manager[],
  adminRunCrews?: RunCrew[]
}
```

### RunCrew
```typescript
{
  id: string,
  name: string,
  description?: string,
  icon?: string,
  logo?: string,
  isAdmin?: boolean,
  currentManagerId?: string,
  runs: Run[],
  memberships: Membership[],
  messages: Message[],
  announcements: Announcement[],
  leaderboardDynamic: LeaderboardEntry[],
  memberPreviews: MemberPreview[]
}
```

### Run
```typescript
{
  id: string,
  title?: string,
  date?: string | Date,
  scheduledAt?: string | Date,
  time?: string,
  startTime?: string,
  meetUpPoint?: string,
  meetUpAddress?: string,
  totalMiles?: number,
  pace?: string,
  description?: string,
  stravaMapUrl?: string,
  rsvps: RSVP[]
}
```

### RSVP
```typescript
{
  athleteId: string,
  athlete?: {
    id: string,
    firstName: string,
    lastName?: string,
    photoURL?: string
  },
  name?: string,
  photoURL?: string,
  status: 'going' | 'not-going' | 'maybe'
}
```

### Activity
```typescript
{
  id: string,
  activityType: string,
  distance: number, // meters
  duration: number, // seconds
  calories?: number,
  pace?: number | string, // seconds per mile OR formatted string
  startTime: string | Date,
  detailData?: any
}
```

### WeeklyTotals
```typescript
{
  totalDistance: number, // meters
  totalDistanceMiles: number, // calculated: totalDistance / 1609.34
  totalDuration: number, // seconds
  totalCalories: number,
  activityCount: number
}
```

### GarminStatus
```typescript
{
  connected: boolean,
  scopes?: {
    activities: boolean,
    training: boolean
  },
  permissions?: any,
  lastSyncedAt?: string | Date,
  connectedAt?: string | Date,
  disconnectedAt?: string | Date,
  garminUserId?: string
}
```

---

## 5. ALL ROUTES REFERENCED

### Old App Routes

| Route | Usage Location | Purpose |
|-------|---------------|---------|
| `/runcrew/join-or-start` | AthleteHome.jsx:36, 156, 308 | Join or create crew |
| `/athlete-profile` | AthleteHome.jsx:186 | Profile page |
| `/settings` | AthleteHome.jsx:206, 359 | Settings page |
| `/crew/crewadmin` | AthleteHome.jsx:159 | Admin crew dashboard |
| `/runcrew/central` | AthleteHome.jsx:159 | Non-admin crew view |
| `/my-activities` | AthleteHome.jsx:341 | Activities list |
| `/activity/:id` | AthleteHome.jsx:371 | Activity detail |
| `/` | AthleteHome.jsx:148 | Sign out redirect |

### New App Routes (Existing)

| Route | File | Purpose |
|-------|------|---------|
| `/profile` | `app/profile/page.tsx` | Profile page ✅ |
| `/settings` | `app/settings/page.tsx` | Settings page ✅ |
| `/activities` | `app/activities/page.tsx` | Activities list ✅ |
| `/activities/[id]` | `app/activities/[id]/page.tsx` | Activity detail ✅ |
| `/runcrew` | `app/runcrew/page.tsx` | Run crew landing ✅ |
| `/runcrew/[id]` | `app/runcrew/[id]/page.tsx` | Crew detail ✅ |
| `/runcrew/[id]/admin` | `app/runcrew/[id]/admin/page.tsx` | Admin dashboard ✅ |
| `/runcrew/create` | `app/runcrew/create/page.tsx` | Create crew ✅ |
| `/runcrew/join` | `app/runcrew/join/page.tsx` | Join crew ✅ |

### Route Mapping

| Old Route | New Route | Status |
|-----------|-----------|--------|
| `/athlete-profile` | `/profile` | ✅ EXISTS |
| `/settings` | `/settings` | ✅ EXISTS |
| `/runcrew/join-or-start` | `/runcrew` | ⚠️ NEEDS VERIFICATION |
| `/crew/crewadmin` | `/runcrew/[id]/admin` | ✅ EXISTS (needs crew ID) |
| `/runcrew/central` | `/runcrew/[id]` | ✅ EXISTS (needs crew ID) |
| `/my-activities` | `/activities` | ✅ EXISTS |
| `/activity/:id` | `/activities/[id]` | ✅ EXISTS |
| `/` | `/` | ✅ EXISTS |

### Missing Routes in New App

**None** - All routes exist, but navigation patterns differ:
- Old app uses `/crew/crewadmin` - New app needs `/runcrew/${crewId}/admin`
- Old app uses `/runcrew/central` - New app needs `/runcrew/${crewId}`
- Old app uses `/runcrew/join-or-start` - New app uses `/runcrew`

---

## 6. FINAL MIGRATION BLUEPRINT (SURGICAL)

### CREATE `app/hooks/useHydratedAthlete.ts`

**Responsibilities:**
- Read athlete and crew context from localStorage
- Support V2 keys (`MyCrew`, `MyCrewManagerId`) with legacy fallback
- Return fresh data on every render (no caching)

**Imports needed:**
```typescript
import { LocalStorageAPI } from '@/lib/localstorage';
```

**Expected return data:**
```typescript
{
  athlete: any | null,
  athleteId: string | null,
  runCrewId: string | null,
  runCrewManagerId: string | null,
  runCrew: any | null
}
```

**Dependencies:**
- `LocalStorageAPI.getAthleteProfile()`
- `LocalStorageAPI.getAthleteId()`
- `LocalStorageAPI.getMyCrew()` - MUST ADD
- `LocalStorageAPI.getMyCrewManagerId()` - MUST ADD
- `LocalStorageAPI.getRunCrewId()` - MUST ADD (legacy)
- `LocalStorageAPI.getRunCrewManagerId()` - MUST ADD (legacy)
- `LocalStorageAPI.getRunCrewData()` - MUST ADD

**Implementation pattern:**
```typescript
export default function useHydratedAthlete() {
  const athlete = LocalStorageAPI.getAthleteProfile();
  const athleteId = LocalStorageAPI.getAthleteId();
  
  const myCrew = LocalStorageAPI.getMyCrew();
  const myCrewManagerId = LocalStorageAPI.getMyCrewManagerId();
  const legacyRunCrewId = LocalStorageAPI.getRunCrewId();
  const legacyRunCrewManagerId = LocalStorageAPI.getRunCrewManagerId();
  
  const runCrewId = myCrew || legacyRunCrewId || null;
  const runCrewManagerId = myCrewManagerId || legacyRunCrewManagerId || null;
  
  const runCrew = LocalStorageAPI.getRunCrewData();
  
  return { athlete, athleteId, runCrewId, runCrewManagerId, runCrew };
}
```

---

### CREATE `app/hooks/useActivities.ts`

**Responsibilities:**
- Fetch weekly activities for an athlete
- Filter to running activities only (exclude wheelchair)
- Calculate weekly totals (distance, duration, calories, count)
- Load from localStorage first (for 'current' period)
- Fetch from backend if cache empty
- Background refresh after loading from cache
- Update localStorage cache

**Imports needed:**
```typescript
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
```

**Expected return data:**
```typescript
{
  activities: Activity[],
  weeklyTotals: {
    totalDistance: number,
    totalDistanceMiles: number,
    totalDuration: number,
    totalCalories: number,
    activityCount: number
  } | null,
  isLoading: boolean,
  error: string | null,
  refresh: () => void,
  periodLabel: string
}
```

**Dependencies:**
- `LocalStorageAPI.getFullHydrationModel()` - MUST ADD
- `LocalStorageAPI.setFullHydrationModel()` - EXISTS
- `api.get()` - axios instance
- API endpoint: `GET /athlete/${athleteId}/activities/weekly?period=${period}`

**Implementation pattern:**
- Copy exact logic from `gofastfrontend-mvp1/src/hooks/useActivities.js`
- Convert to TypeScript
- Adapt to Next.js patterns

---

### UPDATE `lib/localstorage.ts`

**Add missing methods:**

1. **`getRunCrewData()`**
```typescript
getRunCrewData() {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem('runCrewData');
    return data ? JSON.parse(data) : null;
  }
  return null;
}
```

2. **`setRunCrewData(crew)`**
```typescript
setRunCrewData(crew: any) {
  if (typeof window !== 'undefined') {
    if (crew) {
      localStorage.setItem('runCrewData', JSON.stringify(crew));
    } else {
      localStorage.removeItem('runCrewData');
    }
  }
}
```

3. **`getMyCrew()`** - V2 key
```typescript
getMyCrew() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('MyCrew');
  }
  return null;
}
```

4. **`getMyCrewManagerId()`** - V2 key
```typescript
getMyCrewManagerId() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('MyCrewManagerId');
  }
  return null;
}
```

5. **`getRunCrewId()`** - Legacy key
```typescript
getRunCrewId() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('runCrewId');
  }
  return null;
}
```

6. **`getRunCrewManagerId()`** - Legacy key
```typescript
getRunCrewManagerId() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('runCrewManagerId');
  }
  return null;
}
```

7. **`getFullHydrationModel()`**
```typescript
getFullHydrationModel() {
  if (typeof window === 'undefined') {
    return {
      athlete: null,
      weeklyActivities: [],
      weeklyTotals: null,
      runCrewMemberships: [],
      runCrewManagers: [],
      adminRunCrews: []
    };
  }
  
  try {
    const athlete = JSON.parse(localStorage.getItem('athleteProfile') || 'null');
    const weeklyActivities = JSON.parse(localStorage.getItem('weeklyActivities') || '[]');
    const weeklyTotals = JSON.parse(localStorage.getItem('weeklyTotals') || 'null');
    const runCrewMemberships = JSON.parse(localStorage.getItem('runCrewMemberships') || '[]');
    const runCrewManagers = JSON.parse(localStorage.getItem('runCrewManagers') || '[]');
    const adminRunCrews = JSON.parse(localStorage.getItem('adminRunCrews') || '[]');
    
    return {
      athlete,
      weeklyActivities,
      weeklyTotals,
      runCrewMemberships,
      runCrewManagers,
      adminRunCrews
    };
  } catch (error) {
    console.error('❌ LocalStorageAPI: Failed to parse hydration model', error);
    return {
      athlete: null,
      weeklyActivities: [],
      weeklyTotals: null,
      runCrewMemberships: [],
      runCrewManagers: [],
      adminRunCrews: []
    };
  }
}
```

8. **`clearAll()`**
```typescript
clearAll() {
  if (typeof window !== 'undefined') {
    localStorage.clear();
  }
}
```

---

### UPDATE `app/athlete-home/page.tsx`

**Replace entire file with migrated version:**

**New imports:**
```typescript
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import useHydratedAthlete from '@/hooks/useHydratedAthlete';
import useActivities from '@/hooks/useActivities';
import api from '@/lib/api';
import { Activity, Users, Settings, MapPin, Clock, Calendar } from 'lucide-react';
```

**Add constants:**
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://gofastbackendv2-fall2025.onrender.com/api';
```

**Replace state management:**
```typescript
// Use hooks
const { athlete: athleteProfile, athleteId, runCrewId, runCrewManagerId, runCrew } = useHydratedAthlete();
const { activities: weeklyActivities, weeklyTotals, isLoading: activitiesLoading } = useActivities(athleteId);

// Component state
const router = useRouter();
const isCrewAdmin = useMemo(() => Boolean(runCrewManagerId), [runCrewManagerId]);
const [crew, setCrew] = useState(runCrew);
const [garminConnected, setGarminConnected] = useState(false);
const [checkingConnection, setCheckingConnection] = useState(true);
const [isHydratingCrew, setIsHydratingCrew] = useState(false);
```

**Add computed values:**
```typescript
const nextRun = useMemo(() => { /* ... */ }, [crew]);
const nextRunAttendees = useMemo(() => { /* ... */ }, [nextRun]);
const latestActivity = useMemo(() => { /* ... */ }, [weeklyActivities]);
```

**Add helper functions:**
```typescript
const formatPace = (activity) => { /* ... */ };
const formatDistance = (activity) => { /* ... */ };
const handleSignOut = async () => { /* ... */ };
const handleGoToCrew = () => { /* ... */ };
```

**Add useEffect hooks:**
- RunCrew or Bust redirect
- Crew hydration
- Garmin connection check

**Add UI sections:**
- Header
- Hero Run Crew section
- Weekly stats card
- Garmin connection prompt
- Latest activity card
- RSVP CTA card

**Navigation updates:**
- `/athlete-profile` → `/profile`
- `/crew/crewadmin` → `/runcrew/${runCrewId}/admin`
- `/runcrew/central` → `/runcrew/${runCrewId}`
- `/my-activities` → `/activities`
- `/activity/:id` → `/activities/${id}`

---

### INSTALL `lucide-react`

```bash
npm install lucide-react
```

**Required icons:**
- `Activity`
- `Users`
- `Settings`
- `MapPin`
- `Clock`
- `Calendar`

---

### VERIFY API ENDPOINTS EXIST

1. **`GET /garmin/status?athleteId=${athleteId}`**
   - Status: ✅ EXISTS in backend
   - Response: `{ connected: boolean, ... }`

2. **`GET /athlete/${athleteId}/activities/weekly?period=current`**
   - Status: ⚠️ NEEDS VERIFICATION
   - Expected: `{ success: boolean, activities: Activity[], weeklyTotals: {...}, periodLabel: string }`

3. **`POST /runcrew/hydrate`**
   - Status: ✅ EXISTS (already used in new app)
   - Body: `{ runCrewId, athleteId? }`
   - Response: `{ success: boolean, runCrew: {...} }`

---

## SUMMARY

**Files to CREATE:**
1. `app/hooks/useHydratedAthlete.ts`
2. `app/hooks/useActivities.ts`

**Files to UPDATE:**
1. `lib/localstorage.ts` - Add 8 missing methods
2. `app/athlete-home/page.tsx` - Complete rewrite (436 lines)

**Packages to INSTALL:**
1. `lucide-react`

**API Endpoints to VERIFY:**
1. `/athlete/${athleteId}/activities/weekly` - Needs verification

**Total lines to add:** ~650 lines of code
**Total methods to add:** 8 localStorage methods
**Total hooks to create:** 2 custom hooks
**Total UI sections to add:** 6 major sections

---

**END OF SURGICAL AUDIT**

