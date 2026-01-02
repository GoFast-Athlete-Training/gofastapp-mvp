# RunCrew Admin Routes Analysis

**Date:** 2025-01-XX  
**Purpose:** Analyze API routes needed for RunCrew admin page functionality

---

## Current Admin Page Features

From `app/runcrew/[runCrewId]/admin/page.tsx`:

1. **Announcements** - Display and manage announcements
2. **Members** - List crew members with roles
3. **Runs** - (Expected but not yet implemented)
4. **Events** - (Expected but not yet implemented)
5. **Leaderboard** - (Commented out for now)

---

## API Routes Status

### ✅ Main Crew Route (EXISTS)
**Route:** `GET /api/runcrew/[id]`  
**File:** `app/api/runcrew/[id]/route.ts`

**What it returns:**
- Full crew object with:
  - `memberships` (includes `athlete` data and `role`)
  - `messages` (last 50)
  - `announcements` (last 10)
  - `runs` (ordered by date ascending)
  - ❌ **NOT including `events`**

**Membership Hydration:**
- ✅ Members are hydrated through `RunCrewMembership` junction table
- ✅ Roles are stored in `membership.role` (admin/member/manager)
- ✅ All member data comes from the junction table include

**Usage:**
- Called on page mount with `runCrewId` from URL params
- Returns all data needed for initial render
- No localStorage caching - data fetched fresh each time

---

### ✅ Runs Route (EXISTS)
**Route:** `GET /api/runcrew/[id]/runs`  
**Route:** `POST /api/runcrew/[id]/runs`  
**File:** `app/api/runcrew/[id]/runs/route.ts`

**Status:** ✅ Implemented  
**Functionality:**
- GET: List runs for a crew
- POST: Create new run

**Notes:**
- Runs are also included in main GET route response
- Separate route allows for pagination/filtering if needed

---

### ✅ Announcements Route (EXISTS)
**Route:** `GET /api/runcrew/[id]/announcements`  
**Route:** `POST /api/runcrew/[id]/announcements`  
**File:** `app/api/runcrew/[id]/announcements/route.ts`

**Status:** ✅ Implemented  
**Functionality:**
- GET: List announcements for a crew
- POST: Create new announcement

**Notes:**
- Announcements are also included in main GET route response (last 10)
- Separate route allows for full list/pagination

---

### ✅ Messages Route (EXISTS)
**Route:** `GET /api/runcrew/[id]/messages`  
**Route:** `POST /api/runcrew/[id]/messages`  
**File:** `app/api/runcrew/[id]/messages/route.ts`

**Status:** ✅ Implemented  
**Functionality:**
- GET: List messages for a crew
- POST: Create new message

**Notes:**
- Messages are also included in main GET route response (last 50)
- Separate route allows for full list/pagination

---

### ❌ Events Route (MISSING)
**Route:** `GET /api/runcrew/[id]/events`  
**Route:** `POST /api/runcrew/[id]/events`  
**File:** `app/api/runcrew/[id]/events/route.ts`

**Status:** ❌ **NOT IMPLEMENTED**

**Schema Support:**
- ✅ `RunCrewEvent` model exists in schema
- ✅ Includes: `id`, `runCrewId`, `organizerId`, `title`, `date`, `time`, `location`, `description`, `eventType`
- ✅ Includes `RunCrewEventRSVP` for RSVPs

**What's Missing:**
1. API route file: `app/api/runcrew/[id]/events/route.ts`
2. Events NOT included in `hydrateCrew()` function
3. Events NOT included in main GET route response

**Required Implementation:**
```typescript
// GET /api/runcrew/[id]/events
// POST /api/runcrew/[id]/events
```

**Also Need to Update:**
- `lib/domain-runcrew.ts` - Add events to `hydrateCrew()` include (optional, if we want events in main response)

---

## Data Flow Pattern (Sequenced)

### Current Pattern (Correct)
1. **URL Param** → `runCrewId` from route params
2. **LocalStorage** → `athleteId` for authorization only
3. **API Call** → `GET /api/runcrew/[runCrewId]`
4. **Database Query** → API queries DB via `hydrateCrew()`
5. **Render** → Page renders from API response (no localStorage caching)

### Key Points:
- ✅ No localStorage for crew data
- ✅ Only `athleteId` in localStorage (authorization)
- ✅ All crew data comes from API
- ✅ Fresh data on every page load

---

## Required Actions

### 1. Create Events Route (HIGH PRIORITY)
**File:** `app/api/runcrew/[id]/events/route.ts`

**Implementation should:**
- Follow same pattern as `runs` and `announcements` routes
- GET: Return events for crew (include RSVPs)
- POST: Create new event
- Verify Firebase token
- Check membership/role via Firebase token → athlete lookup
- Use `runCrewId` from URL params

**Example Structure:**
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify Firebase token
  // 2. Get athlete from Firebase ID
  // 3. Get runCrewId from params
  // 4. Verify membership
  // 5. Query events from DB
  // 6. Return events with RSVPs
}

export async function POST(request: Request, ...) {
  // 1. Verify Firebase token
  // 2. Get athlete from Firebase ID
  // 3. Get runCrewId from params
  // 4. Verify membership (admin can create)
  // 5. Create event
  // 6. Return created event
}
```

### 2. Optional: Add Events to hydrateCrew() (LOW PRIORITY)
If we want events in the main GET response:

**File:** `lib/domain-runcrew.ts`

Add to `hydrateCrew()` include:
```typescript
events: {
  include: {
    organizer: { ... },
    rsvps: { ... }
  },
  orderBy: { date: 'asc' }
}
```

**Note:** This is optional - events can be fetched separately if needed.

---

## Routes Summary

| Feature | Route | Status | Included in Main GET? |
|---------|-------|--------|----------------------|
| **Crew Info** | `GET /api/runcrew/[id]` | ✅ | N/A (main route) |
| **Members** | Via main route (`memberships`) | ✅ | ✅ Yes |
| **Announcements** | `GET/POST /api/runcrew/[id]/announcements` | ✅ | ✅ Yes (last 10) |
| **Messages** | `GET/POST /api/runcrew/[id]/messages` | ✅ | ✅ Yes (last 50) |
| **Runs** | `GET/POST /api/runcrew/[id]/runs` | ✅ | ✅ Yes (all) |
| **Events** | `GET/POST /api/runcrew/[id]/events` | ❌ **MISSING** | ❌ No |

---

## Notes

1. **Membership Hydration:** ✅ Complete
   - Members are hydrated through `RunCrewMembership` junction table
   - Roles stored in `membership.role` field
   - No separate manager table needed

2. **Leaderboard:** ⏸️ Commented out for now
   - Not in current scope
   - Will need separate route/calculation when implemented

3. **Data Flow:** ✅ Correct
   - URL params → API → DB → Render
   - No localStorage caching of crew data
   - Only `athleteId` in localStorage (authorization)

4. **Events Gap:** ❌ Needs implementation
   - Schema exists
   - Route missing
   - Not in main GET response

---

## Next Steps

1. **Create Events Route** (`app/api/runcrew/[id]/events/route.ts`)
   - GET endpoint
   - POST endpoint
   - Follow existing patterns (runs/announcements)

2. **Test Events Route**
   - Verify GET returns events
   - Verify POST creates events
   - Verify authorization works

3. **Optional: Add Events to hydrateCrew()**
   - If we want events in main response
   - Otherwise, fetch separately as needed

