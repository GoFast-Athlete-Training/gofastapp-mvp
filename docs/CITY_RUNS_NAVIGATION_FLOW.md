# City Runs Navigation & Flow Analysis

## Overview

Planning the user journey from navigation → city selection → city runs display.

## Quick Summary

**Flow**: `gorun` → `city` → `available runs`

**Navigation**: Add "GoRun" to TopNav (between Home and Settings) → `/gorun`

**Landing Page** (`/gorun`): 
- Hero: "Ready to go run? Select your city and see what's happening"
- City selector (dropdown/grid/search)
- **Decision**: Navigate to `/gorun/[citySlug]` (separate page)

**City Page** (`/gorun/[citySlug]`):
- Header: "{CityName} Runs" (e.g., "Boston Runs")
- **Available runs** displayed as cards (reuse `RunCardPreview.tsx`)
- RunClub hydration: Lazy (render first, hydrate after)

**Key Decisions**:
- ✅ Navigation: TopNav (always visible)
- ✅ City selection: Navigate to separate page (not useEffect)
- ✅ Hydration: Lazy (better UX)
- ✅ URL structure: `/gorun` → `/gorun/[citySlug]`
- ✅ Flow: gorun → city → available runs

---

## 1. Navigation: "GoRun"

### Current Navigation Structure
- **TopNav**: Logo, Home, Settings, Profile (always visible)
- **Sidebar Nav** (athlete-home): RunCrews, Home, Settings, Profile
- **Bottom Nav**: Not currently used

### Location Options

#### Option A: TopNav (Recommended)
Add to `TopNav.tsx` alongside Home, Settings
- **Pros**: Always visible, consistent with other primary actions
- **Cons**: Could get crowded

#### Option B: Sidebar Nav (athlete-home)
Add to sidebar in `/athlete-home`
- **Pros**: More space, organized with other features
- **Cons**: Only visible on athlete-home page

#### Option C: New Primary Nav Item
Add as standalone nav item (like logo/home)
- **Pros**: Prominent, matches "GoRun" branding
- **Cons**: Requires nav redesign

### Recommendation: **Option A (TopNav)**
- **Path**: `/gorun` (matches "GoRun" branding)
- **Icon**: MapPin (from lucide-react)
- **Position**: Between Home and Settings in TopNav
- **Label**: "GoRun" (or just icon with tooltip?)

### Implementation
```tsx
// TopNav.tsx
import { MapPin } from 'lucide-react';

<Link
  href="/gorun"
  className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
  title="GoRun"
>
  <MapPin className="h-5 w-5" />
</Link>
```

---

## 2. Landing Page: City Selection

### URL
`/gorun` (root)

### Content
**Headline**: "Ready to go run? Select your city and see what's happening"

### Flow
```
gorun → city → available runs
```

**Step 1**: User clicks "GoRun" in nav → lands on `/gorun`  
**Step 2**: User selects city → navigates to `/gorun/[citySlug]`  
**Step 3**: User sees available runs for that city → displayed as cards

### UX Options

#### Option A: Dropdown/Select (useEffect - Single Page)
```
[City Select Dropdown]
↓ (onChange)
Show runs for selected city (same page, no navigation)
```

**Pros**:
- Fast (no page reload)
- Simple state management
- Good for MVP

**Cons**:
- URL doesn't reflect selected city (can't share/bookmark)
- Browser back button doesn't work intuitively
- Less SEO-friendly

#### Option B: Navigation (Separate Page)
```
[City Select Dropdown/Grid]
↓ (onSelect)
Navigate to /gorun/[citySlug]
```

**Pros**:
- URL reflects city (`/gorun/boston`)
- Shareable/bookmarkable URLs
- Browser back button works
- SEO-friendly
- Clear separation of concerns

**Cons**:
- Requires navigation logic
- More routes to manage

#### Option C: Hybrid (useEffect + URL Update)
```
[City Select Dropdown]
↓ (onChange)
Update URL: /gorun/[citySlug] (useRouter.push)
Show runs (useEffect reads from URL)
```

**Pros**:
- Fast (no full page reload)
- URL reflects state
- Shareable/bookmarkable
- Browser back button works

**Cons**:
- More complex state management
- Need to sync URL and state

### Recommendation: **Option B (Navigation)**

**Rationale**:
- Clean separation: selection page vs. city page
- Better UX: clear URL structure
- SEO-friendly: each city has its own URL
- Easier to extend: can add city-specific metadata later

### Implementation

**Landing Page** (`/gorun`):
```tsx
- Hero: "Ready to go run? Select your city and see what's happening"
- City selector:
  - Option 1: Dropdown with popular cities
  - Option 2: Grid of city cards (visual, more engaging)
  - Option 3: Search/autocomplete
- On select → navigate to /gorun/[citySlug]
```

**City Page** (`/gorun/[citySlug]`):
```tsx
- Header: "{CityName} Runs" (e.g., "Boston Runs")
- Runs list (cards)
- Filter/sort options (optional)
```

---

## 3. City Container Page

### URL
`/gorun/[citySlug]`

### Examples
- `/gorun/boston`
- `/gorun/new-york`
- `/gorun/washington-dc`

### Page Structure

#### Header
```
[Back Button] | "Boston Runs" | [Filter/Sort Icon?]
```

**Questions**:
- [ ] Do we show city name as "Boston Runs" or "Boston Run"?
- [ ] Do we need a back button or rely on browser back?
- [ ] Do we show city metadata (description, photo)?

#### Content: Runs as Cards

**Card Design** (from `RunCardPreview.tsx`):
```
┌─────────────────────────────────────┐
│ [RunClub Logo] Ballston Runaways    │ ← If hydrated
│ Hosted by Ballston Runaways          │
│                                      │
│ Saturday Morning Long Run            │
│                                      │
│ 📅 Sat, Jan 20 at 6:30 AM          │
│ 📍 Central Park - Bethesda Fountain │
│                                      │
│ [RSVP Button] [View Details]        │
└─────────────────────────────────────┘
```

**Card States**:
- With RunClub affiliation (logo + name)
- Without RunClub (just run details)
- Recurring run indicator
- RSVP status (if user is logged in)

#### Empty State
```
"No runs scheduled for Boston yet"
[Create Run Button?] (if admin/staff)
```

#### Loading State
```
"Loading runs..."
```

---

## 4. Data Flow & Hydration

### Landing Page (`/gorun`)
**Data Needed**:
- List of cities with runs (for dropdown/grid)
- Count of runs per city (optional)

**API**: `GET /api/runs/cities` (needs to be created)
```typescript
// Query: SELECT DISTINCT citySlug, COUNT(*) FROM city_runs GROUP BY citySlug
// Response:
{
  "success": true,
  "cities": [
    { 
      "slug": "boston", 
      "name": "Boston", // Normalized from slug
      "runCount": 12 
    },
    { 
      "slug": "new-york", 
      "name": "New York",
      "runCount": 8 
    }
  ]
}
```

**Alternative**: Hardcode popular cities for MVP, fetch dynamically later

### City Page (`/gorun/[citySlug]`) - Available Runs

**Purpose**: Show all available runs for the selected city

**Data Needed**:
- Runs for city (filtered by `citySlug`)
- RunClub data (if `runClubSlug` is set) - needs hydration

**API**: `GET /api/runs/city/[citySlug]` (needs to be created)
```typescript
// Query: SELECT * FROM city_runs WHERE citySlug = ? ORDER BY date ASC
// Response:
{
  "success": true,
  "citySlug": "boston",
  "cityName": "Boston", // Normalized from slug
  "runs": [
    {
      "id": "...",
      "title": "Saturday Morning Long Run",
      "runClubSlug": "ballston-runaways", // String reference
      "runClub": null, // Not hydrated yet (will be populated client-side)
      "date": "2025-01-20T00:00:00Z",
      "startDate": "2025-01-20T00:00:00Z",
      "isRecurring": false,
      "dayOfWeek": null,
      "startTimeHour": 6,
      "startTimeMinute": 30,
      "startTimePeriod": "AM",
      "meetUpPoint": "Central Park - Bethesda Fountain",
      "meetUpAddress": "...",
      "totalMiles": 5.0,
      "pace": "7:00-8:00",
      "description": "...",
      ...
    }
  ]
}
```

**Hydration Strategy**:

#### Option A: Eager Hydration (Before Render)
```typescript
useEffect(() => {
  async function hydrateRuns() {
    // 1. Fetch runs
    const runsResponse = await fetch(`/api/runs/city/${citySlug}`);
    const { runs } = await runsResponse.json();
    
    // 2. Extract unique runClubSlug values
    const slugs = [...new Set(runs.map(r => r.runClubSlug).filter(Boolean))];
    
    // 3. Check which RunClubs we already have
    const existingClubs = await prisma.run_clubs.findMany({
      where: { slug: { in: slugs } }
    });
    const existingSlugs = new Set(existingClubs.map(c => c.slug));
    
    // 4. Pull missing RunClubs
    const missingSlugs = slugs.filter(s => !existingSlugs.has(s));
    await Promise.all(missingSlugs.map(slug => 
      fetch('/api/runclub/pull-and-save', {
        method: 'POST',
        body: JSON.stringify({ slug })
      })
    ));
    
    // 5. Attach RunClub data to runs
    const allClubs = await prisma.run_clubs.findMany({
      where: { slug: { in: slugs } }
    });
    const clubMap = new Map(allClubs.map(c => [c.slug, c]));
    
    const hydratedRuns = runs.map(run => ({
      ...run,
      runClub: run.runClubSlug ? clubMap.get(run.runClubSlug) : null
    }));
    
    setRuns(hydratedRuns);
  }
  hydrateRuns();
}, [citySlug]);
```

#### Option B: Lazy Hydration (Render First, Hydrate After)
```typescript
// Render cards immediately with slug
// Hydrate RunClub data in background
// Update cards when data arrives (better UX, feels faster)
```

**Recommendation**: **Option B (Lazy Hydration)** - Better perceived performance

---

## 5. Component Structure

### Landing Page (`/gorun/page.tsx`)
```
app/gorun/page.tsx
├── TopNav (reuse existing)
├── Hero section
│   └── "Ready to go run? Select your city and see what's happening"
├── CitySelector component
│   ├── Option A: Dropdown (simple)
│   ├── Option B: Grid of city cards (visual)
│   └── Option C: Search/autocomplete (advanced)
│   └── Navigate to /gorun/[citySlug] on select
└── Loading/empty states
```

### City Page (`/gorun/[citySlug]/page.tsx`)
```
app/gorun/[citySlug]/page.tsx
├── TopNav (reuse existing)
├── CityHeader component
│   ├── Back button (to /gorun)
│   ├── City name: "{CityName} Runs"
│   └── Optional: City metadata (description, photo)
├── RunsList component
│   ├── RunCard (reuse RunCardPreview.tsx)
│   │   ├── RunClub logo + name (if hydrated)
│   │   ├── Run details (title, date, location)
│   │   └── RSVP button (if logged in)
│   ├── Empty state: "No runs scheduled"
│   ├── Loading state: "Loading runs..."
│   └── Error state: "Failed to load runs"
└── Hydration logic (useEffect)
    ├── Fetch runs for city
    ├── Extract unique runClubSlug values
    ├── Check run_clubs table
    ├── Pull missing RunClub data
    └── Attach RunClub data to runs
```

### Components to Create/Reuse
- `CitySelector` - City selection UI
- `CityHeader` - City page header
- `RunsList` - List of run cards
- `RunCard` - Individual run card (reuse `RunCardPreview.tsx`)
- `RunClubHydrator` - Logic to pull/save RunClub data

---

## 6. Routing Structure

```
/gorun                    → Landing page (city selection)
/gorun/[citySlug]         → City runs page
/gorun/[citySlug]/[runId] → Run detail page (future)
```

---

## 7. Open Questions

### Navigation
- [ ] What's the exact nav label? "GoRun" or "Runs"?
- [ ] Where in the nav hierarchy?
- [ ] Icon choice?

### Landing Page
- [ ] Dropdown vs. grid vs. search for city selection?
- [ ] Show run counts per city?
- [ ] Show featured cities vs. all cities?

### City Page
- [ ] "Boston Runs" vs. "Boston Run"?
- [ ] Show city metadata (description, photo)?
- [ ] Filter/sort options (date, distance, pace)?
- [ ] Pagination or infinite scroll?

### Data
- [ ] How to get list of cities with runs?
- [ ] Cache RunClub data? (TTL?)
- [ ] Handle RunClub sync failures gracefully?

### UX
- [ ] Show recurring runs differently?
- [ ] Group by date?
- [ ] Show "next run" prominently?

---

## 8. Implementation Phases

### Phase 1: MVP (Current)
- [x] Navigation item "GoRun"
- [ ] Landing page with city selection
- [ ] City page with runs list
- [ ] Basic RunCard display
- [ ] RunClub hydration (pull-and-save)

### Phase 2: Enhancement
- [ ] City metadata display
- [ ] Filter/sort options
- [ ] Run detail page
- [ ] RSVP functionality
- [ ] Recurring run indicators

### Phase 3: Advanced
- [ ] Search/autocomplete
- [ ] Map view
- [ ] RunClub logo caching
- [ ] Analytics/tracking

---

## 9. Recommendations Summary

1. **Navigation**: Add "GoRun" to primary nav → `/gorun`
2. **Landing Page**: City selection → Navigate to `/gorun/[citySlug]` (Option B)
3. **City Page**: Header + Runs cards (reuse `RunCardPreview.tsx`)
4. **Hydration**: Pull RunClub data on city page load (lazy hydration)
5. **URL Structure**: Clean, shareable URLs (`/gorun/boston`)

---

## Next Steps

1. ✅ Create this analysis document
2. [ ] Get user feedback on navigation label and placement
3. [ ] Decide on city selection UX (dropdown vs. grid)
4. [ ] Create API endpoints:
   - `GET /api/runs/cities` (list cities with runs)
   - `GET /api/runs/city/[citySlug]` (runs for city)
5. [ ] Implement landing page (`/gorun`)
6. [ ] Implement city page (`/gorun/[citySlug]`)
7. [ ] Implement RunClub hydration logic
8. [ ] Test end-to-end flow

