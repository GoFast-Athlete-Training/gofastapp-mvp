# Website Runs Bolt-On Architecture

**Key Concept:** Runs are "bolted on" to websites - each website shows runs for its associated city/region.

---

## Architecture

### Website → CitySlug Mapping

Each website (domain) is associated with a `citySlug` that determines which runs to show:

```
dcruns.gofastcrushgoals.com → citySlug: "washington-dc"
bostonruns.gofastcrushgoals.com → citySlug: "boston"
```

### How CitySlug is Determined

**Option 1: From HomePage slug** (Current Implementation)
- HomePage has a `slug` field (e.g., "dc", "boston")
- This slug is used as `citySlug` for filtering runs
- Example: HomePage with slug "dc" → shows runs with `citySlug: "washington-dc"` or "dc"

**Option 2: Explicit citySlug field** (Future Enhancement)
- Add `citySlug` field to HomePage model
- Allows explicit mapping: slug="home" but citySlug="washington-dc"
- More flexible for multi-city websites

**Option 3: Website-level citySlug** (Future Enhancement)
- Add `citySlug` field to Website model
- All pages on that website inherit the citySlug
- Best for single-city websites

---

## Current Implementation

### HomePage Configuration

```typescript
// HomePage model fields:
{
  slug: "dc", // Used as citySlug for runs filtering
  showFeaturedRuns: true, // Enable featured runs section
  featuredRunsCitySlug: null, // Optional override (if null, uses slug)
  featuredRunsLimit: 6, // Number of runs to show
}
```

### Featured Runs Component

```typescript
<FeaturedRuns 
  citySlug={page.featuredRunsCitySlug || page.slug} // Falls back to slug
  limit={page.featuredRunsLimit || 6}
  websiteId={page.websiteId}
/>
```

### Runs Listing Page

The `/runs` page should also respect website context:
- Get website from domain
- Get citySlug from website/HomePage
- Filter runs by that citySlug by default
- Allow user to override with filters

---

## Database Schema Changes Needed

### Option A: Add citySlug to HomePage (Recommended)

```prisma
model HomePage {
  // ... existing fields
  citySlug String? // Explicit city slug for runs filtering (e.g., "washington-dc")
  // If null, falls back to slug field
}
```

**Pros:**
- Flexible - can have slug="home" but citySlug="washington-dc"
- Explicit mapping
- Easy to query

**Cons:**
- Requires migration
- Need to populate existing records

### Option B: Add citySlug to Website

```prisma
model Website {
  // ... existing fields
  citySlug String? // City slug for all pages on this website
}
```

**Pros:**
- Single source of truth per website
- All pages inherit citySlug
- Good for single-city websites

**Cons:**
- Less flexible for multi-city websites
- Requires migration

---

## Implementation Flow

### 1. Homepage Loads

```
User visits: dcruns.gofastcrushgoals.com
  ↓
Lookup HomePage by domain + slug ""
  ↓
HomePage has: slug="dc", showFeaturedRuns=true
  ↓
FeaturedRuns component receives: citySlug="dc"
  ↓
Fetches runs: GET /api/runs/public?citySlug=dc
  ↓
Shows 6 DC runs
```

### 2. Runs Listing Page

```
User visits: dcruns.gofastcrushgoals.com/runs
  ↓
Get website from domain
  ↓
Get citySlug from website/HomePage (default: "dc")
  ↓
Fetch runs: GET /api/runs/public?citySlug=dc
  ↓
Show all DC runs (user can filter)
```

### 3. Run Detail Page

```
User clicks run card
  ↓
Navigate to: /runs/[runId]
  ↓
Fetch run: GET /api/runs/public/[runId]
  ↓
Show run details
  ↓
RSVP button → redirects to app
```

---

## URL Structure

### Current URLs

- `/` - Homepage (with featured runs if enabled)
- `/runs` - All runs (filtered by website's citySlug)
- `/runs/[runId]` - Run detail

### Future URLs (Phase 3)

- `/dc` - City navigation page
- `/runclub/[slug]` - Run club detail
- `/topic/[type]/[slug]` - Generic topic detail

---

## Configuration Examples

### DC Runs Website

```typescript
// HomePage record
{
  slug: "dc",
  showFeaturedRuns: true,
  featuredRunsCitySlug: "washington-dc", // Explicit override
  featuredRunsLimit: 6,
}
```

### Boston Runs Website

```typescript
// HomePage record
{
  slug: "boston",
  showFeaturedRuns: true,
  featuredRunsCitySlug: null, // Uses slug "boston" as citySlug
  featuredRunsLimit: 6,
}
```

### Multi-City Website (Future)

```typescript
// HomePage record
{
  slug: "home",
  showFeaturedRuns: true,
  featuredRunsCitySlug: null, // Would need Website-level citySlug
  featuredRunsLimit: 6,
}
```

---

## API Integration

### Public Runs API

The `/api/runs/public` endpoint accepts `citySlug` query param:

```
GET /api/runs/public?citySlug=washington-dc
GET /api/runs/public?citySlug=washington-dc&day=Saturday
```

### CitySlug Matching

Runs are stored with `citySlug` field in `city_runs` table:
- Exact match: `citySlug = "washington-dc"`
- Partial match: Could support `citySlug LIKE "washington%"` (future)

---

## Migration Path

1. **Phase 1:** Use HomePage `slug` as citySlug (current)
2. **Phase 2:** Add `citySlug` field to HomePage (optional override)
3. **Phase 3:** Add `citySlug` to Website (if needed for multi-city sites)

---

## Key Points

✅ **Runs are website-scoped** - Each website shows its city's runs  
✅ **CitySlug comes from HomePage** - Uses slug field (or explicit citySlug)  
✅ **Featured Runs is optional** - Controlled by `showFeaturedRuns` flag  
✅ **Runs page respects website** - Defaults to website's citySlug  
✅ **User can override** - Filters allow changing city/day  

