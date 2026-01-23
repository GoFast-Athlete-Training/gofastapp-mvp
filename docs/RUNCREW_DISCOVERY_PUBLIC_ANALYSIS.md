# RunCrew Discovery Page - Public URL Analysis

**Date:** January 2025  
**Status:** 🔍 Analysis Phase  
**Goal:** Create public discovery page similar to invite flow

---

## Current State Analysis

### 1. **Current Discovery Page** (`/app/runcrew/page.tsx`)

**Route:** `/runcrew`  
**Authentication:** ✅ **REQUIRED** (uses authenticated API calls)

**Key Findings:**
- Uses `api.get()` which automatically adds Bearer token via interceptor
- Includes `TopNav` component (shows profile, sign out - requires auth)
- Links to `/runcrew/${crew.id}` (member-only container page)
- Uses authenticated endpoints:
  - `api.get('/runcrew/discover')` 
  - `api.get('/runcrew/locations')`
- CTA button says "View Details" (links to member container)

**Problem:** 
- Page requires authentication to view
- Cannot be embedded on public website
- Links go to member-only pages
- Uses internal IDs instead of public handles

---

### 2. **Public Invite Flow** (`/app/join/runcrew/[handle]/page.tsx`)

**Route:** `/join/runcrew/[handle]`  
**Authentication:** ❌ **NOT REQUIRED** (public access)

**Key Features:**
- Uses `fetch()` directly (no auth interceptor)
- Public URL by handle/slug: `/join/runcrew/boston-runners`
- Fetches from `/api/runcrew/public/handle/[handle]` (truly public endpoint)
- Shows card-style UI with:
  - Crew name, logo, description
  - Location, purpose, pace info
  - "Join this Crew" CTA
- Handles both authenticated and unauthenticated users
- Same signup flow as invite process

**This is the pattern we need to replicate for discovery!**

---

## API Endpoints Analysis

### `/api/runcrew/discover` (Current)
- **Documentation says:** "No authentication required"
- **Reality:** Page uses `api.get()` which adds auth token
- **Returns:** Crew data but **missing `handle` field**
- **Status:** API is public, but client-side wrapper requires auth

### `/api/runcrew/public/handle/[handle]` (Existing)
- **Authentication:** ❌ Not required
- **Returns:** Public metadata by handle
- **Used by:** Invite flow
- **Status:** ✅ Works perfectly for public access

### `/api/runcrew/locations` (Current)
- **Used by:** Discovery page for location filters
- **Authentication:** Need to check if this is public

---

## What Needs to Change

### 1. **API Updates**
- ✅ Add `handle` field to `/api/runcrew/discover` response
- ✅ Update `getDiscoverableRunCrews()` to include `handle` in select and return

### 2. **New Public Discovery Page**
- **Route:** `/groups` or `/discover` (public URL)
- **Authentication:** ❌ Not required
- **API Calls:** Use `fetch()` instead of `api.get()`
- **Navigation:** No TopNav (or public version)
- **Links:** Point to `/join/runcrew/[handle]` instead of `/runcrew/[id]`
- **CTA:** "Join this Crew" instead of "View Details"

### 3. **Keep Existing Page**
- `/runcrew` can remain for authenticated users
- Or redirect authenticated users to public page
- Or merge into one page that works for both

---

## Proposed Solution

### Option A: New Public Route (Recommended)
Create `/groups` as public discovery page:
- No authentication required
- Uses `fetch()` for API calls
- Links to `/join/runcrew/[handle]`
- Can be embedded on website
- Same UI/UX as current discovery page

### Option B: Make Current Page Public
Modify `/runcrew` to work without auth:
- Use `fetch()` instead of `api.get()`
- Remove or conditionally show TopNav
- Update links to use handles
- Handle both authenticated and unauthenticated states

---

## Implementation Checklist

- [ ] Update `getDiscoverableRunCrews()` to include `handle` field
- [ ] Update `/api/runcrew/discover` response type to include `handle`
- [ ] Create public discovery page (new route or modify existing)
- [ ] Replace `api.get()` with `fetch()` for public access
- [ ] Update card links from `/runcrew/${id}` to `/join/runcrew/${handle}`
- [ ] Change CTA from "View Details" to "Join this Crew"
- [ ] Remove or conditionally render TopNav
- [ ] Test with unauthenticated users
- [ ] Verify public URLs work on website

---

## Questions to Resolve

1. **Route name:** `/groups`, `/discover`, or keep `/runcrew`?
2. **TopNav:** Remove entirely or create public version?
3. **Location API:** Is `/api/runcrew/locations` public? Need to check.
4. **Race search:** The discovery page uses `/api/race/search` - is this public?
5. **Existing page:** Keep `/runcrew` for authenticated users or redirect?

---

## Similar Patterns in Codebase

### Invite Flow Pattern (What we're replicating):
```
Public URL: /join/runcrew/[handle]
↓
fetch('/api/runcrew/public/handle/[handle]')
↓
Show card with "Join this Crew" CTA
↓
Redirects to signup if not authenticated
```

### Discovery Flow Pattern (What we need):
```
Public URL: /groups (or /discover)
↓
fetch('/api/runcrew/discover?params')
↓
Show cards with "Join this Crew" CTA
↓
Links to /join/runcrew/[handle]
```

---

## Next Steps

1. ✅ Analyze current implementation (this document)
2. ⏳ Decide on route name and approach
3. ⏳ Update API to return handles
4. ⏳ Create public discovery page
5. ⏳ Test and verify







