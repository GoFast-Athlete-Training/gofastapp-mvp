# Website Flow Implementation Plan

**Date:** 2025-01-XX  
**Status:** Planning  
**Goal:** Implement complete DC Runs website flow from homepage → city navigation → topic details → public runs

---

## Overview

Complete website flow for DC Runs:
1. **Main Page** - Hero with "Explore Running Life" CTA + **Featured Runs** (bolt-on)
2. **Content Page** - City overview with CTAs in sections
3. **City/Navigation Page** - Cards for run clubs, businesses, other run-specific content
4. **TopicDetail Page** - Specific detail pages (run club, business, etc.)
5. **Public Runs** - Simple listing page (accessed via "View All Runs" link), RSVP requires auth

**Key Insight:** Public runs is a **bolt-on feature** - featured on homepage, simple listing page, not a full navigation section.

### Visual Flow

```
┌─────────────────────────────────────┐
│  Homepage (/)                       │
│  - Hero + CTA                      │
│  - Featured Runs (bolt-on) ⚡       │ ← Shows 3-6 runs
│    └─ "View All Runs" link          │
└──────────────┬──────────────────────┘
               │
               ├─→ Content Page (/running-life)
               │   └─→ City Nav Page (/dc)
               │       ├─→ Run Clubs
               │       ├─→ Businesses
               │       └─→ Other Topics
               │
               └─→ /runs (Simple Listing) ⚡
                   ├─ Filters (city, day)
                   ├─ Run cards
                   └─ Run detail (/runs/[id])
                       └─ RSVP (→ app)
```

**Bolt-On Philosophy:**
- Runs appear **contextually** (homepage, city pages)
- Simple `/runs` listing (no complex nav)
- Not in main masthead navigation
- Quick to implement, easy to maintain

---

## Current State

### ✅ What Exists

1. **Main Page** (`/`)
   - `HomePageRenderer` component
   - Hero section with CTA support
   - ✅ Working

2. **Content Pages** (`/[slug]`)
   - `ContentPageRenderer` component
   - Multiple sections with CTAs
   - ✅ Working

3. **Run Club Detail** (`/runclub/[slug]`)
   - `PublicRunClubContainer` component
   - Shows runs for that club
   - ✅ Working (using fake data)

4. **Public Runs API** (in gofastapp-mvp)
   - `/api/runs/public` endpoint
   - ✅ Created (needs testing)

### ❌ What's Missing

1. **City/Navigation Page** - Cards for run clubs, businesses, etc.
2. **Public Runs Pages** - Browse runs in content repo
3. **TopicDetail Component** - Generic component for businesses, etc.
4. **Content Section CTAs** - CTAs within sections (not just bottom)
5. **Run Club API Integration** - Replace fake data with real API calls
6. **Cross-App Auth Flow** - RSVP redirects to app for auth

---

## Phased Implementation Plan

---

## Phase 1: Foundation & API Setup

**Goal:** Set up APIs and data fetching infrastructure

### 1.1 Public Runs API (gofastapp-mvp)
- [x] Create `/api/runs/public` endpoint (no auth)
- [ ] Create `/api/runs/public/[runId]` endpoint (no auth)
- [ ] Test endpoints return public-safe data
- [ ] Add RunClub hydration option (optional query param)

**Files:**
- `gofastapp-mvp/app/api/runs/public/route.ts` ✅ Created
- `gofastapp-mvp/app/api/runs/public/[runId]/route.ts` ⏳ TODO

**API Response Structure:**
```typescript
// GET /api/runs/public?citySlug=washington-dc&day=Saturday
{
  success: true,
  runs: [
    {
      id: string;
      title: string;
      citySlug: string;
      isRecurring: boolean;
      dayOfWeek: string | null;
      startDate: string;
      meetUpPoint: string;
      meetUpCity: string | null;
      startTimeHour: number | null;
      startTimeMinute: number | null;
      startTimePeriod: string | null;
      totalMiles: number | null;
      pace: string | null;
      description: string | null;
      runClubSlug: string | null;
      // No sensitive fields (runCrewId, etc.)
    }
  ]
}
```

### 1.2 Run Club Public API (GoFastCompany)
- [ ] Verify `/api/runclub/public/[slug]` endpoint exists
- [ ] Test endpoint returns public-safe data
- [ ] Ensure runs are included in response

**Files:**
- `GoFastCompany/app/api/runclub/public/[slug]/route.ts` ✅ Exists (verify)

### 1.3 Environment Variables (gofast-contentpublic)
- [ ] Add `GOFAST_APP_API_URL` environment variable
- [ ] Add to `.env.example`
- [ ] Document in README

**Example:**
```bash
GOFAST_APP_API_URL=https://app.gofastcrushgoals.com
```

---

## Phase 2: Content Section CTAs

**Goal:** Enable CTAs within content sections (not just bottom)

### 2.1 Enhance ContentSection Component
- [ ] Add optional `ctaText` and `ctaHref` props to `ContentSection`
- [ ] Render CTA button within section
- [ ] Style consistently with existing CTASection

**Files:**
- `gofast-contentpublic/components/ContentSection.tsx`

**Changes:**
```typescript
interface ContentSectionProps {
  title?: string | null;
  subtitle?: string | null;
  text: string;
  photo?: any;
  imageSide?: ContentPageImageSide | null;
  // NEW:
  ctaText?: string | null;
  ctaHref?: string | null;
}
```

### 2.2 Update ContentPageRenderer
- [ ] Pass CTA props from page data to ContentSection
- [ ] Support CTAs in contentBlocks array

**Files:**
- `gofast-contentpublic/components/ContentPageRenderer.tsx`

### 2.3 Update Database Schema (GoFastCompany)
- [ ] Add `section1CtaText`, `section1CtaHref` fields to ContentPage model
- [ ] Add for section2 and section3
- [ ] Add to contentBlocks JSON structure

**Files:**
- `GoFastCompany/prisma/schema.prisma` (ContentPage model)

---

## Phase 3: City/Navigation Page

**Goal:** Create city navigation page with cards for run clubs, businesses, etc.

### 3.1 Create City Navigation Page Route
- [ ] Create `/city/[citySlug]/page.tsx` route
- [ ] Or use `/dc`, `/boston`, etc. as slugs
- [ ] Fetch city data from API

**Files:**
- `gofast-contentpublic/app/city/[citySlug]/page.tsx` (NEW)

**Route Options:**
- Option A: `/city/washington-dc`
- Option B: `/dc` (simpler, matches domain)
- **Recommendation:** Option B for cleaner URLs

### 3.2 Create CityNavigationPage Component
- [ ] Hero section: City name, photo, paragraph
- [ ] Navigation cards grid:
  - Run Clubs card
  - Businesses card
  - Other run-specific cards
- [ ] Each card links to TopicDetail page

**Files:**
- `gofast-contentpublic/components/city/CityNavigationPage.tsx` (NEW)

**Component Structure:**
```typescript
interface CityNavigationPageProps {
  city: {
    slug: string;
    name: string;
    description: string;
    photo: PhotoObject | null;
  };
  navigationCards: NavigationCard[];
}

interface NavigationCard {
  id: string;
  type: 'run-club' | 'business' | 'other';
  title: string;
  description: string;
  imageUrl?: string;
  href: string;
  count?: number; // e.g., "12 Run Clubs"
}
```

### 3.3 Create NavigationCard Component
- [ ] Reusable card component
- [ ] Shows image, title, description
- [ ] Optional count badge
- [ ] Hover effects
- [ ] **Note:** Runs card links to `/runs` (simple listing, not full nav)

**Files:**
- `gofast-contentpublic/components/city/NavigationCard.tsx` (NEW)

### 3.4 Create City Data API (GoFastCompany)
- [ ] Create `/api/content/city/[citySlug]` endpoint
- [ ] Returns city info + navigation cards data
- [ ] Includes counts (e.g., number of run clubs)

**Files:**
- `GoFastCompany/app/api/content/city/[citySlug]/route.ts` (NEW)

**Response Structure:**
```typescript
{
  success: true,
  city: {
    slug: string;
    name: string;
    description: string;
    photo: PhotoObject | null;
  },
  navigationCards: [
    {
      id: 'run-clubs',
      type: 'run-club',
      title: 'Run Clubs',
      description: 'Find local running clubs',
      href: '/runclubs',
      count: 12
    },
    {
      id: 'businesses',
      type: 'business',
      title: 'Running Businesses',
      description: 'Stores, gyms, and more',
      href: '/businesses',
      count: 8
    }
  ]
}
```

---

## Phase 4: TopicDetail Pages

**Goal:** Create generic TopicDetail component for run clubs, businesses, etc.

### 4.1 Create TopicDetail Route
- [ ] Create `/topic/[type]/[slug]/page.tsx` route
- [ ] Types: `run-club`, `business`, etc.
- [ ] Fetch topic data from API

**Files:**
- `gofast-contentpublic/app/topic/[type]/[slug]/page.tsx` (NEW)

**Route Examples:**
- `/topic/run-club/ballston-runaways`
- `/topic/business/fleet-feet-dc`

### 4.2 Create TopicDetail Component
- [ ] Generic component that handles different topic types
- [ ] Shows topic info, description, photo
- [ ] **For run clubs:** Shows runs (reuse PublicRunClubContainer logic)
- [ ] **For businesses:** Shows business details

**Files:**
- `gofast-contentpublic/components/topic/TopicDetail.tsx` (NEW)

**Component Structure:**
```typescript
interface TopicDetailProps {
  topic: {
    type: 'run-club' | 'business' | 'other';
    slug: string;
    name: string;
    description: string;
    photo: PhotoObject | null;
    // Run club specific:
    runs?: Run[];
    // Business specific:
    address?: string;
    website?: string;
  };
}
```

### 4.3 Create Topic API (GoFastCompany)
- [ ] Create `/api/content/topic/[type]/[slug]` endpoint
- [ ] Returns topic data based on type
- [ ] For run clubs: includes runs data

**Files:**
- `GoFastCompany/app/api/content/topic/[type]/[slug]/route.ts` (NEW)

### 4.4 Update Run Club Page
- [ ] Replace fake data with API call
- [ ] Use new TopicDetail component or keep separate
- [ ] **Decision:** Keep `/runclub/[slug]` separate or migrate to `/topic/run-club/[slug]`?

**Files:**
- `gofast-contentpublic/app/runclub/[slug]/page.tsx` (UPDATE)

---

## Phase 5: Public Runs (Bolt-On Feature)

**Goal:** Add runs as a simple bolt-on feature - featured on homepage, simple listing page

### 5.1 Add Featured Runs to Homepage
- [ ] Add "Featured Runs" section to `HomePageRenderer`
- [ ] Fetch 3-6 upcoming runs from API
- [ ] Display as cards
- [ ] Add "View All Runs" link

**Files:**
- `gofast-contentpublic/components/HomePageRenderer.tsx` (UPDATE)
- `gofast-contentpublic/components/runs/FeaturedRuns.tsx` (NEW)

**Component Structure:**
```typescript
// In HomePageRenderer
{page.showFeaturedRuns && (
  <FeaturedRuns 
    citySlug={page.featuredRunsCitySlug} // Optional filter
    limit={6}
  />
)}
```

### 5.2 Create Simple Runs Listing Page
- [ ] Create `/runs/page.tsx` route (simple, no complex nav)
- [ ] Fetch runs from `/api/runs/public` (gofastapp-mvp)
- [ ] Show filters: City, Day (simple dropdowns)
- [ ] Display run cards grid
- [ ] Keep it minimal - just runs, no extra navigation

**Files:**
- `gofast-contentpublic/app/runs/page.tsx` (NEW)

**Component Structure:**
```typescript
'use client';

export default function PublicRunsPage() {
  const [runs, setRuns] = useState([]);
  const [cityFilter, setCityFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  
  // Fetch from gofastapp-mvp API
  const fetchRuns = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_GOFAST_APP_API_URL;
    const params = new URLSearchParams();
    if (cityFilter) params.append('citySlug', cityFilter);
    if (dayFilter) params.append('day', dayFilter);
    
    const response = await fetch(`${apiUrl}/api/runs/public?${params}`);
    const data = await response.json();
    setRuns(data.runs || []);
  };
  
  // ... render run cards
}
```

### 5.2 Create Run Card Component
- [ ] Reusable run card component
- [ ] Shows: title, date/time, location, distance, pace
- [ ] Links to run detail page
- [ ] Optional RSVP button (requires auth)

**Files:**
- `gofast-contentpublic/components/runs/RunCard.tsx` (NEW)

### 5.3 Create Run Detail Page
- [ ] Create `/runs/[runId]/page.tsx` route
- [ ] Fetch run from `/api/runs/public/[runId]`
- [ ] Show full run details
- [ ] RSVP button (redirects to app if not auth'd)

**Files:**
- `gofast-contentpublic/app/runs/[runId]/page.tsx` (NEW)

### 5.4 Create Run Detail Component
- [ ] Component for displaying run details
- [ ] Shows: title, date/time, location, description, route map
- [ ] RSVP section (conditional based on auth)

**Files:**
- `gofast-contentpublic/components/runs/RunDetail.tsx` (NEW)

### 5.5 RSVP Flow (Cross-App Auth)
- [ ] Check if user is authenticated (client-side check)
- [ ] If not auth'd: Redirect to app signup/login with return URL
- [ ] If auth'd: Show RSVP button (calls app API)
- [ ] Handle return from app after auth

**Flow:**
```
User clicks RSVP
  ↓
Check localStorage/cookie for auth token
  ↓
IF not authenticated:
  → Redirect to: https://app.gofastcrushgoals.com/signup?returnUrl=/runs/[runId]
  ↓
User signs up/logs in
  ↓
App redirects back to content site
  ↓
Content site checks auth (via cookie/token)
  ↓
Show RSVP button
```

**Files:**
- `gofast-contentpublic/lib/auth.ts` (NEW - auth utilities)
- `gofast-contentpublic/components/runs/RSVPButton.tsx` (NEW)

---

## Phase 6: Integration & Flow Completion

**Goal:** Connect all pieces together

### 6.1 Update Content Pages
- [ ] Add CTAs in content sections pointing to city pages
- [ ] Example: "Explore DC Running" → `/dc`

**Files:**
- Content pages in GoFastCompany dashboard

### 6.2 Update City Navigation Cards
- [ ] Run Clubs card → `/topic/run-club/[slug]` or `/runclubs`
- [ ] Businesses card → `/topic/business/[slug]` or `/businesses`
- [ ] Runs card → `/runs` (simple listing page, bolt-on feature)

### 6.3 Update Run Club Detail Pages
- [ ] Add "View All Runs" link → `/runs?citySlug=[city]`
- [ ] Add "Browse Other Clubs" link → `/dc` (city nav page)

### 6.4 Navigation & Masthead
- [ ] **Don't add "Runs" to main nav** - it's a bolt-on feature
- [ ] Add city links if multiple cities
- [ ] "View All Runs" link appears contextually (homepage, city pages)

**Files:**
- `gofast-contentpublic/components/GoFastMasthead.tsx`

---

## Phase 7: Data Migration & API Integration

**Goal:** Replace fake data with real API calls

### 7.1 Run Club Data
- [ ] Replace `getFakeRunClub()` with API call
- [ ] Use `/api/runclub/public/[slug]` from GoFastCompany
- [ ] Handle loading/error states

**Files:**
- `gofast-contentpublic/app/runclub/[slug]/page.tsx`

### 7.2 City Data
- [ ] Create city records in database
- [ ] Add city photos, descriptions
- [ ] Set up navigation cards data

**Files:**
- GoFastCompany database migrations

### 7.3 Topic Data
- [ ] Migrate run club data to topic structure
- [ ] Add business data
- [ ] Set up topic API endpoints

---

## Phase 8: Polish & Optimization

**Goal:** Final touches and performance

### 8.1 SEO
- [ ] Add metadata to all pages
- [ ] Generate sitemap
- [ ] Add structured data (JSON-LD)

### 8.2 Performance
- [ ] Add caching for API calls
- [ ] Optimize images
- [ ] Lazy load run cards

### 8.3 Error Handling
- [ ] 404 pages for missing runs/clubs
- [ ] Error boundaries
- [ ] Loading states

### 8.4 Mobile Responsiveness
- [ ] Test all pages on mobile
- [ ] Optimize card layouts
- [ ] Touch-friendly buttons

---

## Implementation Order

**Recommended Sequence:**

1. **Phase 1** - Foundation (APIs) ⚡ **START HERE**
2. **Phase 5** - Public Runs (bolt-on: homepage + simple listing) ⚡ **QUICK WIN**
3. **Phase 2** - Content Section CTAs (enables better CTAs)
4. **Phase 3** - City Navigation Page
5. **Phase 4** - TopicDetail Pages
6. **Phase 6** - Integration (connects everything)
7. **Phase 7** - Data Migration
8. **Phase 8** - Polish

**Note:** Phase 5 (Public Runs) is intentionally simple - it's a bolt-on feature, not a full navigation section. Keep it minimal.

---

## Key Decisions Needed

### 1. URL Structure
- **City pages:** `/dc` vs `/city/washington-dc`?
- **Topic pages:** `/topic/run-club/[slug]` vs `/runclub/[slug]`?
- **Runs:** `/runs` (simple bolt-on, not `/gorun`)

**Recommendation:**
- City: `/dc` (simpler)
- Topics: Keep `/runclub/[slug]` for now, add `/topic/[type]/[slug]` for new types
- Runs: `/runs` (simple listing, bolt-on feature - not part of main nav)

### 2. Authentication Flow
- **Option A:** Redirect to app for auth, return to content site
- **Option B:** Embed auth in content site (more complex)
- **Option C:** Show RSVP button, redirect to app for action

**Recommendation:** Option C (simplest)

### 3. Component Reuse
- **Run Club Detail:** Keep separate component or use generic TopicDetail?
- **Run Cards:** Reuse from app or create new?

**Recommendation:**
- Keep run club detail separate (already working)
- Create new run cards for content site (different styling needs)

---

## Testing Checklist

### Phase 1
- [ ] Public runs API returns correct data
- [ ] Run detail API works
- [ ] No sensitive data exposed

### Phase 2
- [ ] CTAs render in sections
- [ ] Links work correctly
- [ ] Styling matches design

### Phase 3
- [ ] City page loads
- [ ] Navigation cards display
- [ ] Links to topic pages work

### Phase 4
- [ ] TopicDetail pages load
- [ ] Run clubs show runs
- [ ] Businesses display correctly

### Phase 5 (Bolt-On)
- [ ] Featured runs show on homepage
- [ ] "View All Runs" link works
- [ ] Simple runs listing page loads without auth
- [ ] Filters work (city, day)
- [ ] Run detail page works
- [ ] RSVP flow redirects correctly
- [ ] **Keep it simple** - no complex navigation, just runs

### Phase 6
- [ ] All links connect properly
- [ ] Flow from homepage → runs works
- [ ] Navigation is intuitive

---

## Success Metrics

- ✅ Users can browse runs without signing up
- ✅ Users can discover run clubs from city pages
- ✅ RSVP flow works seamlessly
- ✅ All pages load quickly (< 2s)
- ✅ Mobile experience is smooth
- ✅ SEO-friendly URLs and metadata

---

## Related Documentation

- `WEBSITE_FLOW_ANALYSIS.md` - Current state analysis
- `FIREBASE_CROSS_APP_AUTH.md` - Auth flow details
- `GORUN_PUBLIC_APP_ONLY_STRATEGY.md` - App-side strategy
- `CITY_RUNS_NAVIGATION_FLOW.md` - City navigation flow

