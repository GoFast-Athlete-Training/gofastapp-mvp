# RunClub Data Flow - Current State

**Date:** 2025-01-XX  
**Question:** How are we saving RunClub data to gofastapp-mvp when it lives in GoFastCompany DB?

---

## Current Architecture

### Data Storage

**GoFastCompany DB:**
- `acq_run_clubs` table (canonical source)
- Contains: name, logo, city, description, vibe, CRM fields, etc.
- API endpoint: `/api/runclub-public/by-slug/[slug]`

**gofastapp-mvp DB:**
- `run_clubs` table (minimal denormalized copy)
- Contains: `slug`, `name`, `logoUrl`, `city`, `syncedAt`
- Purpose: Fast display without cross-DB queries

---

## Current Implementation

### 1. Pull-and-Save Endpoint

**Location:** `app/api/runclub/pull-and-save/route.ts`

**What it does:**
- Takes `{ slug: string }` in request body
- Fetches RunClub from GoFastCompany API (`/api/runclub-public/by-slug/[slug]`)
- Upserts minimal fields (`name`, `logoUrl`, `city`) into `run_clubs` table
- Returns saved RunClub data

**Status:** ✅ **ENDPOINT EXISTS** but **NOT CALLED ANYWHERE**

---

## Problem: When/Where Should We Save?

### Current State: **NOT AUTOMATIC**

**When runs are created:**
- `POST /api/runs/create` accepts `runClubSlug` parameter
- Saves `runClubSlug` to `city_runs.runClubSlug` field
- **BUT:** Does NOT automatically pull/save RunClub data to `run_clubs` table

**When runs are displayed:**
- `GET /api/runs` queries `city_runs` table
- Gets `runClubSlug` from runs
- Tries to JOIN with `run_clubs` table
- **IF MISSING:** Background hydration attempts to fetch (but may fail silently)

---

## Options for When to Save RunClub Data

### Option 1: On Run Creation (Dual Save)

**When:** When a run is created with `runClubSlug`

**Implementation:**
```typescript
// In /api/runs/create route.ts
if (runClubSlug) {
  // Pull and save RunClub data
  await fetch('/api/runclub/pull-and-save', {
    method: 'POST',
    body: JSON.stringify({ slug: runClubSlug })
  });
}
```

**Pros:**
- ✅ Data is guaranteed to exist when runs are displayed
- ✅ No lazy loading needed
- ✅ Fast reads (no API calls during display)

**Cons:**
- ❌ Adds latency to run creation
- ❌ Requires GoFastCompany API to be available during run creation
- ❌ If pull fails, run creation might fail (or we need error handling)

---

### Option 2: Lazy Hydration on Display (Current)

**When:** When runs are displayed and RunClub data is missing

**Implementation:**
```typescript
// In lib/domain-runs.ts getRuns()
const missingSlugs = runClubSlugs.filter(slug => !clubMap.has(slug));
if (missingSlugs.length > 0) {
  // Background hydration (non-blocking)
  hydrateRunClubsInBackground(missingSlugs);
}
```

**Pros:**
- ✅ Doesn't slow down run creation
- ✅ Self-healing (missing data gets populated eventually)
- ✅ Non-blocking (runs display even if hydration fails)

**Cons:**
- ❌ First display might not have RunClub logos/names
- ❌ Requires GoFastCompany API to be available during reads
- ❌ More complex error handling

---

### Option 3: Manual/Admin Trigger

**When:** Admin manually triggers pull-and-save

**Implementation:**
- Admin UI button: "Sync RunClub Data"
- Calls `/api/runclub/pull-and-save` for specific slug

**Pros:**
- ✅ Full control over when sync happens
- ✅ Can batch sync multiple RunClubs

**Cons:**
- ❌ Manual process (easy to forget)
- ❌ Not automatic

---

### Option 4: Hybrid (Recommended for MVP1)

**When:** 
1. On run creation (if possible, non-blocking)
2. On display (lazy hydration as fallback)

**Implementation:**
```typescript
// In /api/runs/create route.ts
if (runClubSlug) {
  // Try to pull-and-save, but don't fail run creation if it fails
  try {
    await fetch('/api/runclub/pull-and-save', {
      method: 'POST',
      body: JSON.stringify({ slug: runClubSlug })
    });
  } catch (error) {
    console.warn('Failed to pull RunClub data, will hydrate on display:', error);
  }
}

// In lib/domain-runs.ts getRuns()
// Still do lazy hydration as fallback
```

**Pros:**
- ✅ Best of both worlds
- ✅ Data usually exists (from creation)
- ✅ Fallback if creation-time sync fails
- ✅ Non-blocking (doesn't fail run creation)

**Cons:**
- ❌ More complex implementation
- ❌ Two code paths to maintain

---

## Recommendation for MVP1

**Use Option 4 (Hybrid):**

1. **On Run Creation:** Try to pull-and-save RunClub data (non-blocking, don't fail if it errors)
2. **On Display:** Lazy hydration as fallback (current implementation)

**Why:**
- Most runs will have RunClub data from creation
- Fallback ensures data eventually appears
- Doesn't break run creation if GoFastCompany API is down
- Simple to implement

---

## Implementation Steps

### Step 1: Update `/api/runs/create` to pull RunClub data

```typescript
// After creating the run, if runClubSlug exists:
if (runClubSlug) {
  // Non-blocking: try to pull RunClub data
  // Don't await - let it happen in background
  fetch(`${process.env.NEXT_PUBLIC_API_URL || '/api'}/runclub/pull-and-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: runClubSlug }),
  }).catch(err => {
    console.warn('Failed to pull RunClub data on run creation:', err);
  });
}
```

### Step 2: Keep lazy hydration in `getRuns()`

```typescript
// Current implementation is fine - keep it as fallback
const missingSlugs = runClubSlugs.filter(slug => !clubMap.has(slug));
if (missingSlugs.length > 0) {
  hydrateRunClubsInBackground(missingSlugs).catch(err => {
    console.error('Background RunClub hydration failed:', err);
  });
}
```

---

## Current Gaps

1. ❌ `/api/runs/create` does NOT call pull-and-save
2. ✅ `/api/runclub/pull-and-save` endpoint exists but unused
3. ✅ Lazy hydration exists but may not work if GoFastCompany API is down
4. ❌ No error handling if RunClub data is missing

---

## Next Steps

1. ✅ Document current state (this doc)
2. ⏳ Implement Option 4 (Hybrid approach)
3. ⏳ Test run creation with RunClub slug
4. ⏳ Test display with missing RunClub data
5. ⏳ Verify lazy hydration works

