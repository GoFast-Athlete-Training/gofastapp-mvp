# Website Flow Analysis - DC Runs

## Current Structure Overview

This document maps out the current website flow structure for DC Runs and identifies what exists vs. what's planned.

---

## Flow Breakdown

### A. Main Page (Homepage)
**Location**: `/` (root)  
**Component**: `HomePageRenderer.tsx`  
**File**: `gofast-contentpublic/app/page.tsx`

**Current Structure**:
- Hero section with title, subtitle, description
- Hero image (optional)
- Primary CTA button (optional)
- Simple, minimal landing page

**Example Flow**:
```
Homepage → CTA "Explore Running Life" → Content Page
```

**Current Implementation**:
```12:31:gofast-contentpublic/app/page.tsx
export default async function HomePage() {
  const [page, mastheadData] = await Promise.all([
    lookupHomePageByDomainAndSlug(''),
    lookupWebsiteForMasthead(),
  ]);
  
  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <GoFastMasthead 
        websiteData={mastheadData?.website}
        pages={mastheadData?.pages}
      />
      <HomePageRenderer page={page} />
    </div>
  );
}
```

**CTA Section**:
```102:112:gofast-contentpublic/components/HomePageRenderer.tsx
          {/* Primary CTA */}
          {page.ctaText && page.ctaHref && (
            <div className="mt-12">
              <a
                href={page.ctaHref}
                className="inline-block px-8 py-4 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 transition-colors shadow-lg hover:shadow-xl"
              >
                {page.ctaText}
              </a>
            </div>
          )}
```

---

### B. Content Page (City Overview)
**Location**: `/[slug]` (dynamic routes)  
**Component**: `ContentPageRenderer.tsx`  
**File**: `gofast-contentpublic/app/[...slug]/page.tsx`

**Current Structure**:
- Hero section (title, subhead, intro)
- Multiple content sections (1-3 sections)
  - Each section can have: title, subtitle, text, photo
  - Photos can be left or right aligned
- CTA section at bottom
- Flexible content blocks support

**Example Flow**:
```
Content Page (City Overview) → CTAs in sections → City/Navigation Page
```

**Current Implementation**:
```54:121:gofast-contentpublic/components/ContentPageRenderer.tsx
export default function ContentPageRenderer({ page }: ContentPageRendererProps) {
  const contentBlocks = Array.isArray(page.contentBlocks)
    ? page.contentBlocks
    : [];

  const useBlocks = contentBlocks.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <HeroSection title={page.title} subhead={page.subhead} intro={page.intro} />

      {useBlocks ? (
        contentBlocks.map((block: any, index: number) => (
          <ContentSection
            key={`block-${index}`}
            title={block.title || undefined}
            subtitle={block.subtitle || undefined}
            text={block.content || ""}
            imageUrl={block.imageUrl || undefined}
            imageSide={block.imageSide || undefined}
          />
        ))
      ) : (
        <>
          {/* Section 1 */}
          {page.section1Text && (
            <ContentSection
              title={page.section1Title}
              text={page.section1Text}
              photo={page.section1Photo}
              imageSide={page.section1ImageSide}
            />
          )}

          {/* Section 2 */}
          {page.section2Text && (
            <ContentSection
              title={page.section2Title}
              text={page.section2Text}
              photo={page.section2Photo}
              imageSide={page.section2ImageSide}
            />
          )}

          {/* Section 3 */}
          {page.section3Text && (
            <ContentSection
              title={page.section3Title}
              text={page.section3Text}
              photo={page.section3Photo}
              imageSide={page.section3ImageSide}
            />
          )}
        </>
      )}

      {/* CTA Section */}
      {page.ctaText && (
        <CTASection
          text={page.ctaText}
          buttonLabel={page.ctaButtonLabel}
          buttonHref={page.ctaButtonHref}
        />
      )}
    </div>
  );
}
```

**Note**: CTAs can be added to each section via `ctaButtonHref` in the CTA section, but individual section CTAs would need to be added to `ContentSection` component.

---

### C. City/Navigation Page (Planned)
**Location**: `/city/[citySlug]` or similar  
**Status**: ❌ **NOT YET IMPLEMENTED**

**Planned Structure** (based on your description):
- Paragraph + photo (city overview)
- Navigation cards:
  - Run Clubs
  - Businesses
  - Other run-specific content
- Cards link to TopicDetail pages

**What Exists Instead**:
- Run Club detail pages: `/runclub/[slug]`
- No city-specific navigation page yet

---

### D. TopicDetail Page (Run Club Detail)
**Location**: `/runclub/[slug]`  
**Component**: `PublicRunClubContainer.tsx`  
**File**: `gofast-contentpublic/app/runclub/[slug]/page.tsx`

**Current Structure**:
- Banner section with group photo/logo
- About section
- **Runs section** - Shows all runs for the club
- Sidebar with:
  - Location info
  - Sponsored races
  - Social links (website, Instagram, Strava)

**Runs Display**:
```216:304:gofast-contentpublic/components/runclub/PublicRunClubContainer.tsx
            {/* Runs Section - One Card Per Run */}
            <div className="bg-white rounded-xl shadow-md p-6 md:p-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                Runs We Do
              </h2>
              <div className="space-y-4">
                {runClub.runs && runClub.runs.length > 0 ? (
                  runClub.runs.map((run) => (
                    <div
                      key={run.id}
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {/* Run Type Icon */}
                        <div className="flex-shrink-0 mt-1">
                          {getRunTypeIcon(run.type)}
                        </div>
                        
                        {/* Run Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-xl font-semibold text-gray-900">
                                {run.title}
                              </h3>
                              <span className="inline-block mt-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                {getRunTypeLabel(run.type)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-gray-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{run.day}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{run.time}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div className="text-sm">
                                <p className="font-medium">{run.meetupPoint}</p>
                                {run.neighborhood && (
                                  <p className="text-gray-500">{run.neighborhood}</p>
                                )}
                                {run.meetupAddress && (
                                  <p className="text-gray-500">{run.meetupAddress}</p>
                                )}
                              </div>
                            </div>
                            
                            {(run.distance || run.pace) && (
                              <div className="pt-2 border-t border-gray-100 space-y-1">
                                {run.distance && (
                                  <div className="flex items-center gap-2">
                                    <Route className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">{run.distance}</span>
                                  </div>
                                )}
                                {run.pace && (
                                  <p className="text-sm">
                                    <span className="font-medium">Pace:</span> {run.pace}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {/* Finish Spot */}
                            {run.finishEstablishmentName && (
                              <div className="pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-2 text-sm">
                                  {getEstablishmentIcon(run.finishEstablishmentType)}
                                  <span className="font-medium">Finish at:</span>
                                  <span>{run.finishEstablishmentName}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 italic">No runs scheduled at this time.</p>
                )}
              </div>
            </div>
```

**Current Implementation**:
```133:144:gofast-contentpublic/app/runclub/[slug]/page.tsx
export default async function PublicRunClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  // Using fake data for now - will replace with API call later
  const runClub = getFakeRunClub(slug);

  return <PublicRunClubContainer runClub={runClub} />;
}
```

---

### E. Public Runs (GoRun App)
**Location**: `/gorun` (in gofastapp-mvp)  
**Component**: `GoRunPage`  
**File**: `gofastapp-mvp/app/gorun/page.tsx`

**Current Structure**:
- Header: "Ready to go run? Select your city and see what's happening"
- Filters:
  - City filter (dropdown)
  - Day filter (dropdown)
- Run cards grid:
  - Run title
  - Mileage & pace
  - City
  - Date & time
  - Location
  - "View Details" button

**Run Card Structure**:
```180:262:gofastapp-mvp/app/gorun/page.tsx
        {/* Runs List */}
        {runs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runs.map((run) => {
              // Format city name from citySlug or use meetUpCity
              const cityName = run.meetUpCity || 
                run.citySlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              
              return (
                <div
                  key={run.id}
                  onClick={() => router.push(`/gorun/${run.id}`)}
                  className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border border-gray-200 hover:border-orange-300"
                >
                  {/* Run Name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-4 line-clamp-2">
                    {run.title}
                  </h3>

                  {/* Mileage & Pace */}
                  <div className="flex items-center gap-4 mb-3">
                    {run.totalMiles && (
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span className="text-lg">🏃</span>
                        <span className="font-semibold">{run.totalMiles}</span>
                        <span className="text-sm text-gray-600">miles</span>
                      </div>
                    )}
                    {run.pace && (
                      <div className="flex items-center gap-1.5 text-gray-700">
                        <span className="text-lg">⚡</span>
                        <span className="font-semibold">{run.pace}</span>
                      </div>
                    )}
                  </div>

                  {/* City */}
                  <div className="flex items-center gap-2 text-gray-600 mb-4">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium">{cityName}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="space-y-1.5 mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        {run.isRecurring ? (
                          <span>
                            Every <span className="font-semibold text-gray-900">{run.dayOfWeek}</span>
                          </span>
                        ) : (
                          formatDate(run.startDate)
                        )}
                      </span>
                    </div>
                    {(run.startTimeHour !== null && run.startTimeMinute !== null) && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatTime(run.startTimeHour, run.startTimeMinute, run.startTimePeriod)}</span>
                      </div>
                    )}
                  </div>

                  {/* Location (truncated) */}
                  <div className="mb-4">
                    <div className="text-sm text-gray-700 font-medium line-clamp-1">
                      {run.meetUpPoint}
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/gorun/${run.id}`);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-semibold transition text-sm"
                  >
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
```

**Run Detail Page**: `/gorun/[runId]`
- Shows full run details
- RunClub/RunCrew header (if applicable)
- RSVP functionality
- Full location details

---

## Current Flow Diagram

```
┌─────────────────┐
│  Main Page (/)  │
│  - Hero         │
│  - CTA Button   │
└────────┬────────┘
         │
         │ CTA: "Explore Running Life"
         ▼
┌─────────────────────┐
│  Content Page       │
│  (City Overview)    │
│  - Multiple sections│
│  - CTAs in sections │
└────────┬────────────┘
         │
         │ CTA links
         ▼
┌─────────────────────┐
│  Run Club Detail    │
│  /runclub/[slug]    │
│  - About            │
│  - Runs list        │
└─────────────────────┘

┌─────────────────────┐
│  GoRun App          │
│  /gorun             │
│  - All runs         │
│  - Filters          │
│  - Run cards        │
└────────┬────────────┘
         │
         │ Click run card
         ▼
┌─────────────────────┐
│  Run Detail         │
│  /gorun/[runId]     │
│  - Full details     │
│  - RSVP             │
└─────────────────────┘
```

---

## Missing Components

### 1. City/Navigation Page
**Status**: ❌ Not implemented  
**Planned Location**: `/city/[citySlug]` or `/dc` or similar  
**Planned Structure**:
- City paragraph + photo
- Navigation cards:
  - Run Clubs card → links to `/runclub/[slug]`
  - Businesses card → links to `/business/[slug]` (not implemented)
  - Other run-specific cards

**What's Needed**:
- New page component: `CityNavigationPage.tsx`
- Card component for navigation items
- Route: `app/city/[citySlug]/page.tsx` or similar

### 2. TopicDetail Component
**Status**: ⚠️ Partially implemented  
**Current**: Run Club detail page exists (`PublicRunClubContainer`)  
**Missing**: Generic TopicDetail component for other topics (businesses, etc.)

---

## Recommendations

1. **Create City Navigation Page**:
   - New route: `/city/[citySlug]` or `/dc`
   - Component with paragraph, photo, and card grid
   - Cards link to TopicDetail pages

2. **Enhance ContentSection**:
   - Add CTA buttons within sections (not just at bottom)
   - Support for card grids within sections

3. **Create Generic TopicDetail Component**:
   - Reusable component for Run Clubs, Businesses, etc.
   - Or keep separate components but share structure

4. **Connect Website to App**:
   - Link from website run club pages to app runs
   - Or surface runs directly on website

---

## Related Documentation

- `CITY_RUNS_NAVIGATION_FLOW.md` - App-side navigation flow
- `GORUN_PUBLIC_APP_ONLY_STRATEGY.md` - Public runs strategy
- `GORUN_UX_FLOW.md` - GoRun UX flow details

