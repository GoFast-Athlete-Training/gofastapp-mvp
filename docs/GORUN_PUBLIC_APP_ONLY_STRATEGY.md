# GoRun Authenticated App Strategy

**Date:** 2025-01-XX  
**Status:** Strategy Document  
**Decision:** `/gorun` in gofastapp-mvp is AUTHENTICATED ONLY. Public discovery handled by gofast-contentpublic via API.

---

## Executive Summary

**Decision:** Implement `/gorun` as an **authenticated-only page in gofastapp-mvp**. Remove ALL public routes from gofastapp-mvp. Public discovery is handled by gofast-contentpublic (separate Next.js app) which can hit the database via API.

**Rationale:**
- Clear separation: App = authenticated users only
- Content hub = public discovery (can call APIs)
- Eliminates collisions and confusion
- Cleaner architecture

---

## Architecture Decision

### App vs Content Hub Separation

**gofastapp-mvp (App) - AUTHENTICATED ONLY:**
- ✅ `/gorun` - **Authenticated-only** discovery page (requires login)
- ✅ `/api/runs` - **Authenticated-only** API endpoint (requires Bearer token)
- ✅ Browse runs, filter by city/day (after login)
- ✅ RSVP functionality (requires auth)
- ❌ **NO PUBLIC ROUTES** - Remove all public routes to avoid collisions

**gofast-contentpublic (Content Hub) - PUBLIC:**
- ✅ Public discovery pages (can call APIs)
- ✅ Public `/gorun` equivalent (browse runs without auth)
- ✅ Public SEO/marketing pages
- ✅ RunClub landing pages
- ✅ Blog posts, content pages
- ✅ Can hit database via API (no direct DB access needed)

**GoFastCompany (Admin):**
- ✅ Admin interface for creating runs
- ✅ RunClub management
- ✅ Provides APIs for both app and content hub

---

## User Flow

### 1. Public Discovery (No Auth)

```
User visits /gorun
  ↓
Page loads (no auth check)
  ↓
Fetches runs from GET /api/runs (public endpoint)
  ↓
Shows filters (City, Day)
  ↓
User browses runs
  ↓
User can filter by city/day
```

**No authentication required** - User can browse indefinitely

### 2. Action Triggers Auth

```
User clicks "RSVP" or "View Details"
  ↓
Check auth state (client-side)
  ↓
IF not authenticated:
  → Store runId in localStorage (pendingRunId)
  → Redirect to /signup
  → After signup/login:
    → Check for pendingRunId
    → Redirect to /gorun/[runId] or show RSVP modal
  ↓
IF authenticated:
  → Show RSVP modal or navigate to run details
  → Call POST /api/runs/[runId]/rsvp (requires auth)
```

---

## Implementation Pattern

### Similar to `/runcrew-discovery-public`

**Reference:** `app/runcrew-discovery-public/page.tsx`

**Key Pattern:**
1. **No auth check on page load** - Page renders immediately
2. **Public API calls** - Use `fetch()` not `api.get()` (no Bearer token)
3. **Auth check on action** - Only when user clicks "Join" or "RSVP"
4. **Pending state** - Store `pendingRunId` in localStorage
5. **Post-auth redirect** - Handle pending action after signup/login

---

## Page Structure

### `/gorun` Page

```typescript
'use client';

export default function GoRunPage() {
  // NO auth check on mount
  const [runs, setRuns] = useState([]);
  const [cityFilter, setCityFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  
  // Public fetch (no auth)
  useEffect(() => {
    fetchRuns();
  }, [cityFilter, dayFilter]);
  
  const fetchRuns = async () => {
    const params = new URLSearchParams();
    if (cityFilter) params.append('citySlug', cityFilter);
    if (dayFilter) params.append('day', dayFilter);
    
    // Public API call (no Bearer token)
    const response = await fetch(`/api/runs?${params.toString()}`);
    const data = await response.json();
    setRuns(data.runs || []);
  };
  
  const handleRSVP = (runId: string) => {
    // Check auth (client-side)
    const user = auth.currentUser;
    const athleteId = LocalStorageAPI.getAthleteId();
    
    if (!user || !athleteId) {
      // Not authenticated - trigger signup flow
      localStorage.setItem('pendingRunId', runId);
      router.push('/signup');
      return;
    }
    
    // Authenticated - proceed with RSVP
    handleAuthenticatedRSVP(runId);
  };
  
  return (
    <div>
      {/* Filters */}
      <CityFilter value={cityFilter} onChange={setCityFilter} />
      <DayFilter value={dayFilter} onChange={setDayFilter} />
      
      {/* Run Cards */}
      {runs.map(run => (
        <RunCard 
          key={run.id} 
          run={run}
          onRSVP={() => handleRSVP(run.id)}
        />
      ))}
    </div>
  );
}
```

---

## API Endpoints

### Public Endpoint (No Auth)

**Route:** `GET /api/runs`

**Auth:** None required

**Query Params:**
- `citySlug` (optional) - Filter by city slug
- `day` (optional) - Filter by day of week

**Response:**
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

**Implementation:**
```typescript
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const citySlug = searchParams.get('citySlug') || undefined;
    const day = searchParams.get('day') || undefined;
    
    // Public endpoint - no auth check
    const runs = await getPublicRuns({ citySlug, day });
    
    return NextResponse.json({
      success: true,
      runs,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch runs' },
      { status: 500 }
    );
  }
}
```

### Authenticated Endpoint (RSVP)

**Route:** `POST /api/runs/[runId]/rsvp`

**Auth:** Required (Firebase token)

**Body:**
```json
{
  "status": "going" | "maybe" | "not_going"
}
```

**Response:**
```json
{
  "success": true,
  "rsvp": { ... }
}
```

---

## Navigation

### TopNav Addition

**File:** `components/shared/TopNav.tsx`

**Add between Home and Settings:**
```typescript
import { MapPin } from 'lucide-react';

// In TopNav component:
<Link
  href="/gorun"
  className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
  title="GoRun"
>
  <MapPin className="h-5 w-5" />
</Link>
```

**Note:** TopNav shows for all users (authenticated or not), so GoRun link will be visible to everyone.

---

## Post-Auth Flow

### Handling Pending Run RSVP

**After signup/login, check for pending run:**

**File:** `app/signup/page.tsx` or `app/welcome/page.tsx`

```typescript
useEffect(() => {
  const pendingRunId = localStorage.getItem('pendingRunId');
  if (pendingRunId && athleteId) {
    // User just signed up/logged in with pending run
    localStorage.removeItem('pendingRunId');
    // Option 1: Redirect to run details page
    router.push(`/gorun/${pendingRunId}`);
    // Option 2: Show RSVP modal
    // showRSVPModal(pendingRunId);
  }
}, [athleteId]);
```

---

## Database Query Pattern

### Public Runs Query

**File:** `lib/domain-runs.ts` (new file)

```typescript
export async function getPublicRuns(filters: {
  citySlug?: string;
  day?: string;
}) {
  const where: any = {};
  
  // City filter
  if (filters.citySlug) {
    where.citySlug = filters.citySlug;
  }
  
  // Day filter (complex - need to handle recurring vs single)
  if (filters.day) {
    where.OR = [
      // Recurring runs: match dayOfWeek
      { isRecurring: true, dayOfWeek: filters.day },
      // Single runs: infer from startDate
      // (requires date comparison logic)
    ];
  }
  
  const runs = await prisma.city_runs.findMany({
    where,
    orderBy: { startDate: 'asc' },
    // Don't include sensitive data
    select: {
      id: true,
      title: true,
      citySlug: true,
      isRecurring: true,
      dayOfWeek: true,
      startDate: true,
      date: true,
      runClubSlug: true,
      meetUpPoint: true,
      meetUpStreetAddress: true,
      meetUpCity: true,
      meetUpState: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      totalMiles: true,
      pace: true,
      description: true,
      // Don't include: runCrewId, athleteGeneratedId, staffGeneratedId
    },
  });
  
  // Hydrate RunClub data (lazy)
  const runsWithClubs = await hydrateRunClubs(runs);
  
  return runsWithClubs;
}
```

---

## Security Considerations

### Public Endpoint Security

**✅ Safe to expose:**
- Run title, date, time, location
- RunClub name, logo (public data)
- City, state, meetup point

**❌ Should NOT expose:**
- `runCrewId` (private crew runs)
- `athleteGeneratedId` (creator info)
- `staffGeneratedId` (internal staff)
- RSVP details (unless public)
- Private crew information

**Recommendation:** Use Prisma `select` to only return public fields.

---

## RunClub Hydration

### Lazy Hydration Pattern

**Similar to:** `/api/runclub/pull-and-save`

**Flow:**
1. Fetch runs from `city_runs` table
2. Extract unique `runClubSlug` values
3. Check `run_clubs` table for existing data
4. For missing RunClubs, fetch from GoFastCompany API
5. Save to `run_clubs` table
6. Attach RunClub data to runs

**Implementation:**
```typescript
async function hydrateRunClubs(runs: any[]) {
  const slugs = [...new Set(runs.map(r => r.runClubSlug).filter(Boolean))];
  
  // Check existing data
  const existingClubs = await prisma.run_clubs.findMany({
    where: { slug: { in: slugs } },
  });
  
  const existingSlugs = new Set(existingClubs.map(c => c.slug));
  const missingSlugs = slugs.filter(s => !existingSlugs.has(s));
  
  // Fetch missing RunClubs from GoFastCompany
  for (const slug of missingSlugs) {
    try {
      const clubData = await fetchRunClubFromCompany(slug);
      if (clubData) {
        await prisma.run_clubs.upsert({
          where: { slug },
          create: {
            slug,
            name: clubData.name,
            logoUrl: clubData.logoUrl,
            city: clubData.city,
          },
          update: {
            name: clubData.name,
            logoUrl: clubData.logoUrl,
            city: clubData.city,
            syncedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Failed to hydrate RunClub ${slug}:`, error);
    }
  }
  
  // Attach RunClub data to runs
  const allClubs = await prisma.run_clubs.findMany({
    where: { slug: { in: slugs } },
  });
  
  const clubMap = new Map(allClubs.map(c => [c.slug, c]));
  
  return runs.map(run => ({
    ...run,
    runClub: run.runClubSlug ? clubMap.get(run.runClubSlug) : null,
  }));
}
```

---

## Content Hub Strategy

### gofast-contentpublic Responsibilities

**NOT responsible for:**
- ❌ `/gorun` discovery page
- ❌ Run browsing/filtering
- ❌ RSVP functionality

**IS responsible for:**
- ✅ RunClub landing pages (`/runclub/[slug]`)
- ✅ Blog posts about runs
- ✅ SEO/marketing content
- ✅ Public content pages

**Integration:**
- Content hub can link TO `/gorun` in app (cross-domain link)
- App handles all discovery/action flows

---

## Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] Create `GET /api/runs` endpoint (public, no auth)
- [ ] Create `lib/domain-runs.ts` with `getPublicRuns()` function
- [ ] Implement city filter query logic
- [ ] Implement day filter query logic (recurring + single runs)
- [ ] Add RunClub hydration logic
- [ ] Test public endpoint (no auth required)

### Phase 2: Page Implementation

- [ ] Create `app/gorun/page.tsx` (public page, no auth check)
- [ ] Add TopNav link (MapPin icon)
- [ ] Implement city filter dropdown
- [ ] Implement day filter dropdown
- [ ] Create RunCard component
- [ ] Implement filter state management
- [ ] Test public browsing (no auth)

### Phase 3: Auth on Action

- [ ] Implement `handleRSVP()` with auth check
- [ ] Store `pendingRunId` in localStorage
- [ ] Redirect to `/signup` if not authenticated
- [ ] Handle pending run after signup/login
- [ ] Create `POST /api/runs/[runId]/rsvp` endpoint (auth required)
- [ ] Test RSVP flow (auth required)

### Phase 4: RunClub Hydration

- [ ] Implement lazy RunClub hydration
- [ ] Fetch missing RunClubs from GoFastCompany
- [ ] Save to `run_clubs` table
- [ ] Attach RunClub data to runs
- [ ] Test hydration flow

### Phase 5: Polish

- [ ] Add loading states
- [ ] Add error handling
- [ ] Add empty states
- [ ] Test edge cases (no runs, no filters, etc.)
- [ ] Verify security (no sensitive data exposed)

---

## Benefits of This Approach

### 1. Lower Friction
- ✅ Users can browse runs without signup
- ✅ Reduces barrier to discovery
- ✅ More users will explore runs

### 2. Clear Separation
- ✅ App handles discovery → action flow
- ✅ Content hub handles SEO/marketing
- ✅ Clear responsibilities

### 3. Established Pattern
- ✅ Follows `/runcrew-discovery-public` pattern
- ✅ Consistent with existing codebase
- ✅ Easy to maintain

### 4. Security
- ✅ Public endpoint only exposes safe data
- ✅ Auth required for actions (RSVP)
- ✅ No sensitive data leaked

---

## Open Questions

1. **Run Details Page:** Should `/gorun/[runId]` be public or require auth?
   - **Recommendation:** Public viewing, auth for RSVP (same pattern)

2. **RSVP Visibility:** Should RSVP counts be public?
   - **Recommendation:** Yes (public data, builds social proof)

3. **Filter Persistence:** Should filters persist in URL?
   - **Recommendation:** Yes (shareable URLs, better UX)

4. **RunClub Links:** Should RunClub logos link to content hub or app?
   - **Recommendation:** Content hub (SEO/marketing pages)

---

## Related Files

- **Reference Pattern:**
  - `app/runcrew-discovery-public/page.tsx` - Public discovery page
  - `app/api/runcrew/discover/route.ts` - Public API endpoint
  - `app/api/runcrew/public/[crewId]/route.ts` - Public crew endpoint

- **Database:**
  - `prisma/schema.prisma` - `city_runs` model (lines 379-429)
  - `prisma/schema.prisma` - `run_clubs` model (lines 437-453)

- **Utilities:**
  - `lib/utils/dayOfWeek.ts` - Day inference functions

- **Navigation:**
  - `components/shared/TopNav.tsx` - Add GoRun link

---

## Next Steps

1. ✅ **Strategy Document Complete** - This document
2. ⏳ **Review & Approval** - Get feedback on approach
3. ⏳ **Implementation** - Follow checklist above
4. ⏳ **Testing** - Verify public access, auth flow, hydration
5. ⏳ **Deployment** - Deploy to production

