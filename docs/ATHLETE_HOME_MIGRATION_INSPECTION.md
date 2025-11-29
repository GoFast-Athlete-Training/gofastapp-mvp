# Athlete Home Migration Inspection

**Date**: January 2025  
**Purpose**: Comprehensive inspection of `gofastfrontend-mvp1` AthleteHome to prepare migration to `gofastapp-mvp`

---

## 📊 Component Overview

### Old App (`gofastfrontend-mvp1`)
**File**: `src/Pages/Athlete/AthleteHome.jsx` (436 lines)

**Key Features**:
1. **Hero Run Crew Section** - Shows crew info, next run, attendees
2. **Weekly Stats Card** - Miles, activities count, calories
3. **Garmin Connection Prompt** - Conditional display if not connected
4. **Latest Activity Card** - Clickable micro card with latest run details
5. **RSVP CTA** - Prompts user to RSVP to upcoming crew runs
6. **Header** - Logo, profile avatar, settings, sign out

**Dependencies Used**:
- `useHydratedAthlete` hook (reads from localStorage)
- `useActivities` hook (fetches/manages activities)
- React Router (`useNavigate`)
- Firebase Auth (`signOut`)
- Lucide React icons
- LocalStorageAPI

### New App (`gofastapp-mvp`)
**File**: `app/athlete-home/page.tsx` (174 lines)

**Current State**: Basic placeholder with:
- Simple welcome message
- Basic card grid layout
- Links to RunCrew, Activities, Settings
- Minimal functionality

---

## 🔍 Detailed Feature Comparison

### 1. Hero Run Crew Section ✅ MISSING

**Old App Implementation**:
```jsx
{crew && runCrewId ? (
  <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl shadow-xl p-8 text-white">
    <h1>{crew.name || 'Your Run Crew'}</h1>
    {crew.description && <p>{crew.description}</p>}
    {crew.icon && <span>{crew.icon}</span>}
    
    {/* Next Run Card */}
    {nextRun ? (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
        <Calendar /> <h2>Next Run</h2>
        <Clock /> {formattedDate}
        <MapPin /> {nextRun.meetUpPoint}
        {/* Attendee avatars */}
      </div>
    ) : (
      <div>No upcoming runs scheduled</div>
    )}
    
    <button onClick={handleGoToCrew}>View Crew →</button>
  </div>
) : (
  <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
    <Users className="h-16 w-16 text-orange-500" />
    <h2>Join or Create a Run Crew</h2>
    <button onClick={() => navigate('/runcrew/join-or-start')}>
      Get Started →
    </button>
  </div>
)}
```

**Status**: Not in new app  
**Migration Notes**:
- Requires `nextRun` calculation (filters upcoming runs, sorts by date)
- Requires `nextRunAttendees` (first 3 "going" RSVPs)
- Needs crew data from localStorage or API
- Uses Lucide icons (Calendar, Clock, MapPin, Users)

---

### 2. Weekly Stats Card ✅ MISSING

**Old App Implementation**:
```jsx
{garminConnected && weeklyTotals && (
  <div className="bg-white rounded-xl shadow-lg p-6">
    <h3>Your Week</h3>
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center">
        <p className="text-2xl font-bold text-orange-600">
          {weeklyTotals.totalDistanceMiles.toFixed(1)}
        </p>
        <p className="text-sm text-gray-600">Miles</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-orange-600">
          {weeklyTotals.activityCount || weeklyActivities?.length || 0}
        </p>
        <p className="text-sm text-gray-600">Activities</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-orange-600">
          {Math.round(weeklyTotals.totalCalories || 0)}
        </p>
        <p className="text-sm text-gray-600">Calories</p>
      </div>
    </div>
    <button onClick={() => navigate('/my-activities')}>
      View All Activities →
    </button>
  </div>
)}
```

**Status**: Not in new app  
**Migration Notes**:
- Conditional on `garminConnected` status
- Requires `weeklyTotals` object with `totalDistanceMiles`, `activityCount`, `totalCalories`
- Links to activities page

---

### 3. Garmin Connection Prompt ✅ MISSING

**Old App Implementation**:
```jsx
{!checkingConnection && !garminConnected && (
  <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200">
    <div className="flex items-center gap-4">
      <Activity className="h-12 w-12 text-orange-500" />
      <div className="flex-1">
        <h3>Connect Garmin to Track Activities</h3>
        <p>Sync your runs automatically and see your stats on the leaderboard</p>
      </div>
      <button onClick={() => navigate('/settings')}>
        Connect →
      </button>
    </div>
  </div>
)}
```

**Status**: Not in new app  
**Migration Notes**:
- Requires Garmin connection status check
- Uses API endpoint: `/garmin/status?athleteId=${athleteId}`
- Links to settings page

---

### 4. Latest Activity Card ✅ MISSING

**Old App Implementation**:
```jsx
{latestActivity && (
  <div 
    onClick={() => navigate(`/activity/${latestActivity.id}`)}
    className="bg-white rounded-xl shadow-lg p-4 border border-gray-200 hover:border-orange-300 cursor-pointer"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Activity className="h-8 w-8 text-orange-500" />
        <div>
          <h3>Your Latest Run</h3>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {formatDistance(latestActivity) && <span>{formatDistance(latestActivity)}</span>}
            {formatPace(latestActivity) && <span>· {formatPace(latestActivity)}</span>}
            {latestActivity.startTime && <span>· {formattedDate}</span>}
          </div>
        </div>
      </div>
      <ChevronRight />
    </div>
  </div>
)}
```

**Status**: Not in new app  
**Migration Notes**:
- Uses `latestActivity` (first activity from sorted weeklyActivities)
- Requires `formatPace()` helper function
- Requires `formatDistance()` helper function
- Clickable card navigates to activity detail page

---

### 5. RSVP CTA Card ✅ MISSING

**Old App Implementation**:
```jsx
{crew && nextRun && (
  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
    <div className="flex items-center justify-between">
      <div>
        <h3>Your crew is running soon — RSVP now</h3>
        <p>{nextRun.title || 'Upcoming run'} on {formattedDate}</p>
      </div>
      <button onClick={handleGoToCrew}>
        RSVP →
      </button>
    </div>
  </div>
)}
```

**Status**: Not in new app  
**Migration Notes**:
- Only shows if crew exists and nextRun exists
- Prompts user to RSVP to upcoming run
- Links to crew page

---

### 6. Header Section ⚠️ PARTIALLY MISSING

**Old App Implementation**:
```jsx
<header className="bg-white border-b border-gray-200 relative z-50">
  <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <img src="/logo.jpg" alt="GoFast" className="w-8 h-8 rounded-full" />
      <span className="text-xl font-bold text-gray-900">GoFast</span>
    </div>
    <div className="flex items-center gap-3">
      {/* Profile Avatar Button */}
      <button onClick={() => navigate('/athlete-profile')}>
        {athleteProfile?.photoURL ? (
          <img src={athleteProfile.photoURL} className="w-8 h-8 rounded-full" />
        ) : (
          <span className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {athleteProfile?.firstName?.[0] || 'A'}
          </span>
        )}
      </button>
      {/* Settings Button */}
      <button onClick={() => navigate('/settings')}>
        <Settings className="h-5 w-5" />
        <span>Settings</span>
      </button>
      {/* Sign Out Button */}
      <button onClick={handleSignOut}>Sign Out</button>
    </div>
  </div>
</header>
```

**Status**: Not in new app  
**Migration Notes**:
- Logo display
- Profile avatar with fallback initial
- Settings button with icon
- Sign out functionality

---

## 🔧 Required Dependencies & Hooks

### 1. `useHydratedAthlete` Hook ❌ MISSING

**Location (Old)**: `src/hooks/useHydratedAthlete.js`

**Purpose**: Reads athlete and crew context from localStorage

**Returns**:
```typescript
{
  athlete: AthleteProfile,
  athleteId: string,
  runCrewId: string | null,
  runCrewManagerId: string | null,
  runCrew: RunCrew | null
}
```

**Implementation Notes**:
- Reads directly from localStorage on every render (always fresh)
- Uses V2 keys (`MyCrew`, `MyCrewManagerId`) with legacy fallback
- No API calls, just localStorage reads

**Migration**: Need to create this hook in `app/hooks/` or adapt to use existing localStorage utilities

---

### 2. `useActivities` Hook ❌ MISSING

**Location (Old)**: `src/hooks/useActivities.js`

**Purpose**: Fetches and manages weekly activities for an athlete

**Features**:
- Filters to running activities only (excludes wheelchair)
- Calculates weekly totals (distance, duration, calories, count)
- Loads from localStorage first, then fetches from backend if empty
- Background refresh after loading from cache

**Returns**:
```typescript
{
  activities: Activity[],
  weeklyTotals: {
    totalDistance: number,
    totalDistanceMiles: number,
    totalDuration: number,
    totalCalories: number,
    activityCount: number
  },
  isLoading: boolean,
  error: string | null,
  refresh: () => void,
  periodLabel: string
}
```

**API Endpoint**: `GET /athlete/${athleteId}/activities/weekly?period=current`

**Migration**: Need to create this hook or check if similar functionality exists

---

### 3. Helper Functions ❌ MISSING

#### `formatPace(activity)`
Converts pace from seconds per mile to `min:sec/mi` format

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

#### `formatDistance(activity)`
Converts distance from meters to miles

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

---

## 📋 State Management Requirements

### State Variables Needed:

```typescript
// From hooks
const { athlete: athleteProfile, athleteId, runCrewId, runCrewManagerId, runCrew } = useHydratedAthlete();
const { activities: weeklyActivities, weeklyTotals, isLoading: activitiesLoading } = useActivities(athleteId);

// Component state
const [crew, setCrew] = useState(runCrew);
const [garminConnected, setGarminConnected] = useState(false);
const [checkingConnection, setCheckingConnection] = useState(true);
const [isHydratingCrew, setIsHydratingCrew] = useState(false);

// Computed values
const isCrewAdmin = useMemo(() => Boolean(runCrewManagerId), [runCrewManagerId]);
const nextRun = useMemo(() => {
  // Filter and sort upcoming runs
}, [crew]);
const nextRunAttendees = useMemo(() => {
  // Get first 3 "going" RSVPs
}, [nextRun]);
const latestActivity = useMemo(() => {
  // First activity from sorted array
}, [weeklyActivities]);
```

---

## 🔗 API Endpoints Required

1. **Garmin Connection Status**: `GET /garmin/status?athleteId=${athleteId}`
   - Returns: `{ connected: boolean }`
   - Used for conditional display of weekly stats vs connection prompt

2. **RunCrew Hydration**: `POST /runcrew/hydrate`
   - Body: `{ runCrewId, athleteId }`
   - Returns: `{ success: boolean, runCrew: RunCrew }`
   - Used to hydrate crew data if missing from localStorage

3. **Activities Weekly**: `GET /athlete/${athleteId}/activities/weekly?period=current`
   - Returns: `{ success: boolean, activities: Activity[], weeklyTotals: {...}, periodLabel: string }`
   - Used by `useActivities` hook

---

## 🎨 UI/UX Components

### Required Icons (from Lucide React):
- `Activity`
- `Users`
- `Settings`
- `MapPin`
- `Clock`
- `Calendar`

### Styling:
- Tailwind CSS classes (already used in new app)
- Gradient backgrounds (`from-sky-500 to-sky-600`)
- Backdrop blur effects (`backdrop-blur-sm`)
- Conditional rendering based on state

---

## 🔄 Navigation Routes

### Routes Referenced in Old App:
- `/athlete-profile` - Profile page
- `/settings` - Settings page
- `/runcrew/join-or-start` - Join/create crew flow
- `/runcrew/central` - Crew central (non-admin)
- `/crew/crewadmin` - Crew admin (for admins)
- `/my-activities` - Activities list page
- `/activity/:id` - Activity detail page
- `/` - Home/sign out redirect

### Routes in New App (to verify):
- `/profile` - Profile page?
- `/settings` - Settings page ✅
- `/runcrew` - Run crew pages ✅
- `/activities` - Activities page ✅
- `/activities/[id]` - Activity detail ✅

**Action**: Verify route mapping between old and new apps

---

## ⚠️ Key Migration Considerations

### 1. localStorage API Differences

**Old App** (`LocalStorageConfig.js`):
- Uses `getAthleteProfile()` - returns full athlete object
- Uses `getRunCrewData()` - returns full crew object
- Has V2 keys (`MyCrew`, `MyCrewManagerId`) with legacy fallback
- Stores hydration model with `setFullHydrationModel()`

**New App** (`localstorage.ts`):
- Uses `getAthleteProfile()` - compatible ✅
- Missing `getRunCrewData()` method ❌
- Missing V2 crew keys methods ❌
- Has `setFullHydrationModel()` - partially compatible ✅

**Action**: Update `localstorage.ts` to add missing methods or adapt component to use existing methods

---

### 2. Authentication Pattern

**Old App**:
- Uses React Router (`useNavigate`)
- Sign out via Firebase `signOut(auth)`
- Clears all localStorage on sign out

**New App**:
- Uses Next.js Router (`useRouter`)
- Should maintain same sign out pattern

---

### 3. Crew Data Hydration

**Old App Logic**:
```javascript
// If we have runCrewId but no crew data, hydrate it
if (runCrewId && athleteId && !crew && !isHydratingCrew) {
  // Call /runcrew/hydrate endpoint
  // Store in localStorage
}
```

**New App**:
- Already has crew hydration in `athlete-home/page.tsx`
- Need to ensure crew data structure matches

---

### 4. "RunCrew or Bust" Redirect

**Old App**:
```javascript
// Redirect if no crew
if (athleteProfile && !runCrewId) {
  navigate('/runcrew/join-or-start', { replace: true });
  return;
}
```

**Status**: Not in new app  
**Action**: Add this redirect logic

---

## 📝 Migration Checklist

### Phase 1: Dependencies
- [ ] Create `useHydratedAthlete` hook (or adapt existing)
- [ ] Create `useActivities` hook
- [ ] Add helper functions (`formatPace`, `formatDistance`)
- [ ] Verify Lucide React icons are installed

### Phase 2: localStorage API
- [ ] Add `getRunCrewData()` method to `localstorage.ts`
- [ ] Add V2 crew key methods if needed
- [ ] Verify `getAthleteProfile()` compatibility

### Phase 3: Core Components
- [ ] Header section (logo, profile, settings, sign out)
- [ ] Hero Run Crew section
- [ ] Weekly Stats card
- [ ] Garmin Connection prompt
- [ ] Latest Activity card
- [ ] RSVP CTA card

### Phase 4: Logic & State
- [ ] Crew hydration logic
- [ ] Garmin connection check
- [ ] Next run calculation
- [ ] Latest activity calculation
- [ ] RunCrew or Bust redirect
- [ ] Sign out handler

### Phase 5: Navigation
- [ ] Verify all route mappings
- [ ] Update navigation paths to match new app routes
- [ ] Test all click handlers

### Phase 6: API Integration
- [ ] Verify Garmin status endpoint exists
- [ ] Verify runcrew hydrate endpoint
- [ ] Verify activities weekly endpoint
- [ ] Test all API calls

---

## 🚀 Recommended Migration Order

1. **Start with Dependencies** - Create hooks and utilities first
2. **Update localStorage API** - Add missing methods
3. **Build Header** - Simple component to start
4. **Add Hero Section** - Core visual component
5. **Add Stats & Activities** - Data-heavy components
6. **Add Connection Prompt** - Conditional logic
7. **Add RSVP CTA** - Final polish
8. **Testing** - Verify all flows work

---

## 📚 Reference Files

**Old App**:
- `src/Pages/Athlete/AthleteHome.jsx` - Main component
- `src/hooks/useHydratedAthlete.js` - Athlete hook
- `src/hooks/useActivities.js` - Activities hook
- `src/config/LocalStorageConfig.js` - localStorage API
- `docs/ATHLETE_HOME_ARCHITECTURE.md` - Architecture docs

**New App**:
- `app/athlete-home/page.tsx` - Current page
- `lib/localstorage.ts` - localStorage API
- `lib/api.ts` - API client
- `lib/firebase.ts` - Firebase config

---

**Next Steps**: Review this document and prioritize which components to migrate first.

