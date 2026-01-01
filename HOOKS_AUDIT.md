# Hooks Audit - gofastapp-mvp

**Date:** Phase 1 Refactor  
**Purpose:** Document all custom hooks and their usage patterns

---

## Custom Hooks Summary

### 1. `useHydratedAthlete` (hooks/useHydratedAthlete.ts)

**Status:** ⚠️ **PHASE 1 VIOLATION** - Uses localStorage for identity

**Purpose:** 
- SINGLE IDENTITY READER - Reads athlete identity data from localStorage
- Provides athlete profile, ID, crew context, activities, and Garmin status

**Implementation:**
- Reads from localStorage (LocalStorageAPI)
- No API calls, no side effects
- State: athlete, athleteId, runCrewId, runCrewManagerId, weeklyActivities, weeklyTotals, garminConnected, loading, hydrated

**Current Usage:**
- ✅ `app/athlete-home/page.tsx` - Used for athlete profile data
- ✅ `components/athlete/CrewHero.tsx` - Used for athlete data
- ✅ `components/athlete/AthleteHeader.tsx` - Used for athlete profile
- ✅ `app/profile/page.tsx` - Used for athlete profile
- ⚠️ `app/runcrew/[id]/admin/page.tsx` - Used for athlete data (legacy route, Phase 1 uses new routes)

**Phase 1 Impact:**
- **VIOLATION:** This hook reads identity from localStorage, which contradicts Phase 1 principle: "No localStorage for identity"
- **VIOLATION:** Identity should come from cookie, not React hooks
- **Action Required:** These pages should migrate to cookie-based identity via API routes

**Export Alias:**
- `useAthlete()` - Convenience alias that returns `useHydratedAthlete()`

---

### 2. `useRunCrewContext` (hooks/useRunCrewContext.ts)

**Status:** ⚠️ **PHASE 1 VIOLATION** - Uses localStorage for context

**Purpose:**
- CREW CONTEXT HYDRATION - Hydrates full crew data ONLY on /runcrew/* routes
- Checks localStorage cache first, then hydrates from API if needed

**Implementation:**
- Reads from localStorage cache (LocalStorageAPI.getPrimaryCrew, getRunCrewData)
- Makes API call to `/runcrew/hydrate` if cache miss
- Stores result to localStorage
- State: runCrew, loading, hydrated, error

**Current Usage:**
- ❌ **Not found in current codebase** - No active usage found
- Likely used in legacy `/runcrew/[id]` routes (pre-Phase 1)

**Phase 1 Impact:**
- **VIOLATION:** Uses localStorage for crew context
- **VIOLATION:** Phase 1 routes (`/runcrew/[runCrewId]/member` and `/runcrew/[runCrewId]/admin`) are server components that fetch directly, not using this hook
- **Action Required:** Legacy routes using this hook should migrate to server-side fetching

---

### 3. `useActivities` (hooks/useActivities.ts)

**Status:** ⚠️ **PHASE 1 DISABLED** - Activities are MVP2

**Purpose:**
- LOCAL-FIRST hook for activities (RUNS ONLY)
- Loads from localStorage ONLY - no API calls, no useEffect
- Filters to only running activities
- Recalculates totals for runs only

**Implementation:**
- Synchronous read from localStorage (LocalStorageAPI.getFullHydrationModel)
- No state, no effects, no API calls
- Returns: activities, weeklyTotals, isLoading, error, refresh, periodLabel

**Current Usage:**
- ❌ **Not found in current codebase** - No active usage found
- Activities are commented out in `athlete-home/page.tsx` per Phase 1 requirements

**Phase 1 Impact:**
- **DISABLED:** Activities are explicitly MVP2 scope
- All activity-related UI is commented out in Phase 1
- **Action Required:** None - this hook is effectively disabled until MVP2

---

## Standard React Hooks Usage

### Next.js Router Hooks
- `useRouter()` - Used extensively for navigation
- `useParams()` - Used for route parameters
- `useSearchParams()` - Used for query parameters

**Status:** ✅ **OK** - Standard Next.js hooks, no issues

### React State Hooks
- `useState()` - Used extensively for component state
- `useEffect()` - Used for side effects, lifecycle management
- `useCallback()` - Used for memoized callbacks
- `useMemo()` - Used for memoized values
- `useRef()` - Used for refs

**Status:** ✅ **OK** - Standard React hooks, no issues

---

## Files Using Custom Hooks

### useHydratedAthlete Usage:

1. **app/athlete-home/page.tsx**
   ```typescript
   const { athlete, athleteId, runCrewId, runCrewManagerId, weeklyActivities, weeklyTotals, garminConnected, loading, hydrated } = useHydratedAthlete();
   ```
   - **Status:** ⚠️ Phase 1 violation (uses localStorage identity)
   - **Note:** Activities/Garmin UI commented out per Phase 1, but hook still used for athlete profile

2. **components/athlete/CrewHero.tsx**
   ```typescript
   const { athlete } = useHydratedAthlete();
   ```
   - **Status:** ⚠️ Phase 1 violation
   - **Note:** Reads athlete data for crew navigation logic

3. **components/athlete/AthleteHeader.tsx**
   ```typescript
   const { athlete: athleteProfile } = useHydratedAthlete();
   ```
   - **Status:** ⚠️ Phase 1 violation
   - **Note:** Displays athlete profile in header

4. **app/profile/page.tsx**
   ```typescript
   const { athlete: athleteProfile } = useHydratedAthlete();
   ```
   - **Status:** ⚠️ Phase 1 violation
   - **Note:** Profile page uses hook for athlete data

5. **app/runcrew/[id]/admin/page.tsx** (LEGACY ROUTE)
   ```typescript
   const { athlete: hydratedAthlete } = useHydratedAthlete();
   ```
   - **Status:** ⚠️ Legacy route, Phase 1 uses new `/runcrew/[runCrewId]/admin` route
   - **Note:** This is the old route structure, new Phase 1 routes are server components

---

## Phase 1 Compliance Issues

### Critical Violations:

1. **Identity from localStorage (useHydratedAthlete)**
   - **Principle Violated:** "Identity lives in a cookie"
   - **Impact:** Multiple pages still read identity from localStorage via hook
   - **Files Affected:**
     - `app/athlete-home/page.tsx`
     - `components/athlete/CrewHero.tsx`
     - `components/athlete/AthleteHeader.tsx`
     - `app/profile/page.tsx`
     - `app/runcrew/[id]/admin/page.tsx` (legacy)

2. **React Hooks as Identity Source**
   - **Principle Violated:** "No React hooks deriving identity"
   - **Impact:** Identity comes from hook, not cookie/API
   - **Files Affected:** Same as above

### Acceptable Usage:

1. **Standard React Hooks** ✅
   - `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef` - All OK
   - `useRouter`, `useParams`, `useSearchParams` - All OK

2. **Activities Hook (Disabled)** ✅
   - `useActivities` is effectively disabled (MVP2 scope)
   - No active usage found

3. **RunCrew Context Hook (Unused)** ✅
   - `useRunCrewContext` appears unused in current codebase
   - Phase 1 routes use server components instead

---

## Recommendations

### Immediate Actions (Phase 1):

1. **Migrate identity-dependent pages to API routes:**
   - Create API routes that read athleteId from cookie
   - Fetch athlete data server-side
   - Pass data as props to client components (or use server components)

2. **Refactor components using useHydratedAthlete:**
   - `AthleteHeader` - Accept athlete data as prop instead of using hook
   - `CrewHero` - Accept athlete data as prop instead of using hook
   - `athlete-home/page.tsx` - Migrate to server component or fetch via API

3. **Legacy Route Cleanup:**
   - Document that `/runcrew/[id]` routes are legacy
   - Phase 1 routes are `/runcrew/[runCrewId]/member` and `/runcrew/[runCrewId]/admin`
   - Consider deprecating legacy routes

### Future Actions (Post-Phase 1):

1. **Remove useHydratedAthlete hook** - Replace with cookie-based identity pattern
2. **Remove useRunCrewContext hook** - Replace with server-side fetching
3. **Re-enable useActivities** - When activities are reintroduced in MVP2

---

## Hook Dependencies

### useHydratedAthlete Dependencies:
- `@/lib/localstorage` - LocalStorageAPI
- React hooks: `useState`, `useEffect`

### useRunCrewContext Dependencies:
- `@/lib/api` - API client
- `@/lib/localstorage` - LocalStorageAPI
- React hooks: `useState`, `useEffect`
- Next.js: `useParams`

### useActivities Dependencies:
- `@/lib/localstorage` - LocalStorageAPI
- No React hooks (synchronous)

---

## Summary

**Total Custom Hooks:** 3
- `useHydratedAthlete` - ⚠️ Active, Phase 1 violation
- `useRunCrewContext` - ✅ Unused (or legacy only)
- `useActivities` - ✅ Disabled (MVP2)

**Phase 1 Compliance:** ❌ **Non-compliant**
- Identity hooks still in use
- localStorage-based identity pattern still active
- Need migration to cookie-based identity

**Standard React Hooks:** ✅ All OK
- No issues with standard React/Next.js hooks

