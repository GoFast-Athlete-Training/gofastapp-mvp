# GoRun Navigation Investigation

**Date:** 2025-01-XX  
**Status:** Investigation Complete

---

## Summary of Findings

### 1. Is `/gorun` a Public URL?

**Answer: NOT YET IMPLEMENTED**

- ❌ No `/gorun` route exists in `app/gorun/`
- ❌ No API endpoint `/api/runs` exists (only `/api/runs/create` exists)
- ✅ Documentation exists planning for this feature:
  - `docs/GORUN_UX_FLOW.md` - Plans for single page with inline filters
  - `docs/CITY_RUNS_NAVIGATION_FLOW.md` - Plans for city-based navigation
  - `docs/GORUN_INLINE_FILTERS.md` - Plans for filter implementation

**Recommendation:** Should be public (no auth required) based on pattern from `/runcrew-discovery-public` and `/runcrew/public/[crewId]`

---

### 2. Navigation Location

**Current State:**
- ❌ **NOT in TopNav** - `components/shared/TopNav.tsx` only has: Logo, Home, Settings, Profile, Sign Out
- ❌ **NOT in Athlete Home Sidebar** - `app/athlete-home/page.tsx` sidebar only has:
  - Home
  - My RunCrews
  - Discover RunCrews
  - Activities
  - Race Events
  - Profile

**Planned Location (from docs):**
- ✅ Should be in **TopNav** (between Home and Settings)
- ✅ Icon: `MapPin` from lucide-react
- ✅ Path: `/gorun`
- ✅ Label: "GoRun" (or just icon with tooltip)

**Files to Update:**
- `components/shared/TopNav.tsx` - Add GoRun link
- `app/athlete-home/page.tsx` - Optionally add to sidebar (not required per docs)

---

### 3. What Does It Call From Where?

**Current State:**
- ❌ **No API endpoint exists** - `/api/runs` route does not exist
- ✅ Only `/api/runs/create` exists (POST endpoint for creating runs)

**Planned API (from docs):**
- **Endpoint:** `GET /api/runs`
- **Query Params:**
  - `citySlug` (optional) - Filter by city slug (e.g., "boston", "new-york")
  - `day` (optional) - Filter by day of week (e.g., "Monday", "Saturday")
- **Response:**
```json
{
  "success": true,
  "runs": [
    {
      "id": "...",
      "title": "...",
      "citySlug": "boston",
      "isRecurring": true,
      "dayOfWeek": "Saturday",
      "startDate": "...",
      "date": "...",
      "runClubSlug": "ballston-runaways",
      "runClub": { ... }, // Hydrated (lazy)
      "meetUpPoint": "...",
      "startTimeHour": 6,
      "startTimeMinute": 30,
      "startTimePeriod": "AM",
      ...
    }
  ]
}
```

**Database Model:**
- ✅ Model exists: `city_runs` (table: `run_crew_runs`)
- ✅ Fields available:
  - `citySlug` (String) - Indexed
  - `isRecurring` (Boolean) - Indexed
  - `dayOfWeek` (String?) - Indexed
  - `startDate` (DateTime) - Indexed
  - `date` (DateTime) - Indexed
  - `runClubSlug` (String?) - Indexed
  - `meetUpPoint`, `meetUpAddress`, etc.

**Location:** `prisma/schema.prisma` lines 379-429

---

### 4. Container/Page Structure Needed

**Planned Structure (from docs):**

```
/gorun (Single Page with Inline Filters)
├── TopNav (with GoRun highlighted)
├── Hero: "Ready to go run? Select your city and see what's happening"
├── Filters:
│   ├── City filter (dropdown): "All Cities" | "Boston" | "New York" | etc.
│   └── Day filter (dropdown): "All Days" | "Monday" | "Tuesday" | etc.
└── Available Runs:
    └── Run cards (filtered by selections)
        ├── RunClub logo + name (if affiliated)
        ├── Run title
        ├── Date & time
        ├── Location (meet up point)
        └── RSVP button (if logged in)
```

**Data Flow:**
1. **Page Load:** Standard page load (no filters applied initially)
2. **Initial Fetch:** `GET /api/runs` (no query params) - Returns all runs
3. **Filter Applied:** User selects city/day → `GET /api/runs?citySlug=boston&day=Saturday`
4. **Database Query:** Server filters `city_runs` table by:
   - `citySlug` (if provided)
   - `dayOfWeek` (for recurring runs) OR inferred from `startDate`/`date` (for single runs)
5. **RunClub Hydration:** Lazy hydration - Extract unique `runClubSlug` values, check `run_clubs` table, pull missing data from GoFastCompany API if needed

**Day Filter Logic:**
- **Recurring runs:** Use `dayOfWeek` field directly
- **Single runs:** Infer day from `startDate` or `date` using utility function
- ✅ Utility exists: `lib/utils/dayOfWeek.ts`

---

## Implementation Checklist

### Required Files to Create:

1. **Page Route:**
   - `app/gorun/page.tsx` - Main GoRun page with filters and run list

2. **API Route:**
   - `app/api/runs/route.ts` - GET endpoint with query param filtering

3. **Components (optional, can inline):**
   - `components/gorun/RunCard.tsx` - Individual run card display
   - `components/gorun/CityFilter.tsx` - City dropdown filter
   - `components/gorun/DayFilter.tsx` - Day dropdown filter

### Required Files to Update:

1. **Navigation:**
   - `components/shared/TopNav.tsx` - Add GoRun link with MapPin icon

2. **Optional:**
   - `app/athlete-home/page.tsx` - Optionally add to sidebar (not required)

---

## Database Query Pattern

**Example Query (Prisma):**
```typescript
// Get all runs (no filters)
const runs = await prisma.city_runs.findMany({
  where: {
    // Optional: citySlug filter
    citySlug: citySlug || undefined,
    // Optional: day filter
    OR: [
      // Recurring runs: match dayOfWeek
      { isRecurring: true, dayOfWeek: day },
      // Single runs: infer from startDate
      { isRecurring: false, /* check startDate day */ }
    ]
  },
  orderBy: { startDate: 'asc' },
  include: {
    // Optional: include runClub data if hydrated
    // (or hydrate separately)
  }
});
```

**Note:** Day filtering for single runs requires date comparison logic (use `lib/utils/dayOfWeek.ts`)

---

## Public vs Authenticated

**Recommendation: PUBLIC (no auth required)**

**Rationale:**
- Similar to `/runcrew-discovery-public` - public discovery page
- Similar to `/runcrew/public/[crewId]` - public crew viewing
- Runs are public events - should be discoverable without account
- RSVP functionality can require auth (but viewing shouldn't)

**Pattern:**
- Page loads without auth check
- Shows all runs
- RSVP buttons only show/function if user is authenticated
- Can use same pattern as `/runcrew-discovery-public`

---

## Next Steps

1. ✅ **Investigation Complete** - This document
2. ⏳ **Create `/gorun` page** - Single page with inline filters
3. ⏳ **Create `/api/runs` endpoint** - GET with query param filtering
4. ⏳ **Add GoRun to TopNav** - Between Home and Settings
5. ⏳ **Implement filter logic** - City and day filtering
6. ⏳ **Implement RunClub hydration** - Lazy hydration pattern
7. ⏳ **Create RunCard component** - Display individual runs
8. ⏳ **Test public access** - Verify no auth required for viewing

---

## Related Files

- **Documentation:**
  - `docs/GORUN_UX_FLOW.md`
  - `docs/CITY_RUNS_NAVIGATION_FLOW.md`
  - `docs/GORUN_INLINE_FILTERS.md`
  
- **Database Schema:**
  - `prisma/schema.prisma` (lines 379-429: `city_runs` model)
  
- **Utilities:**
  - `lib/utils/dayOfWeek.ts` - Day inference functions
  
- **Navigation:**
  - `components/shared/TopNav.tsx` - Needs GoRun link
  - `app/athlete-home/page.tsx` - Sidebar navigation

- **Similar Patterns:**
  - `app/runcrew-discovery-public/page.tsx` - Public discovery page pattern
  - `app/api/runcrew/discover/route.ts` - Public API endpoint pattern

